// ── Undo context & provider ───────────────────────────────────
// Manages a queue of ReversibleCommand objects, auto-expires
// them after 5 seconds, and exposes push/undo/undoAll actions.
//
// Key design decisions:
// • Uses ref-based timers (not React effect callbacks) so commands
//   expire even across deeply batched renders.
// • Household-scoped — switching households clears the queue.
// • Compatible completions aggregate: "3 items completed — Undo all"
// • Deletions remain individually reversible.

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ReversibleCommand, CachePatch, CommandType } from '../lib/commands'

// ── public context shape ─────────────────────────────────────

// ── cache patch applicator ───────────────────────────────────

function applyCachePatch(queryClient: ReturnType<typeof useQueryClient>, patch: CachePatch) {
  if (patch.operation === 'set') {
    queryClient.setQueryData(patch.queryKey, patch.data)
    return
  }

  if (patch.operation === 'remove') {
    queryClient.setQueryData(patch.queryKey, (old: unknown) => {
      if (!old) return old
      const id = (patch.data as { id: string })?.id
      if (!id) return old
      if (Array.isArray(old)) {
        return old.filter((i: any) => i.id !== id)
      }
      if (typeof old === 'object' && old !== null) {
        const result = { ...(old as Record<string, any>) }
        for (const key of Object.keys(result)) {
          if (result[key]?.items) {
            result[key] = {
              ...result[key],
              items: result[key].items.filter((i: any) => i.id !== id),
            }
          }
        }
        return result
      }
      return old
    })
    return
  }

  if (patch.operation === 'update') {
    queryClient.setQueryData(patch.queryKey, (old: unknown) => {
      if (!old) return old
      const updateData = patch.data as { id: string;[key: string]: unknown }
      if (!updateData?.id) return old
      if (Array.isArray(old)) {
        return old.map((i: any) => (i.id === updateData.id ? { ...i, ...updateData } : i))
      }
      if (typeof old === 'object' && old !== null) {
        const result = { ...(old as Record<string, any>) }
        for (const key of Object.keys(result)) {
          if (result[key]?.items) {
            result[key] = {
              ...result[key],
              items: result[key].items.map((i: any) =>
                i.id === updateData.id ? { ...i, ...updateData } : i,
              ),
            }
          }
        }
        return result
      }
      return old
    })
    return
  }
}

export interface UndoContext {
  /** Push a new reversible command (starts the 5 s undo timer).
   *  Pass an optional `rollback` function to customise the undo path
   *  (e.g., calling a specific API endpoint). When omitted the default
   *  rollback simply invalidates all relevant query keys. */
  pushCommand: (command: ReversibleCommand, rollback?: () => Promise<void>) => void

  /** Execute undo for a specific command by id.
   *  Resolves to `true` when the rollback succeeded. */
  undoCommand: (commandId: string) => Promise<boolean>

  /** Undo all recent commands of a given type (bulk undo for aggregation).
   *  Resolves to `true` when every rollback succeeded. */
  undoAll: (type: CommandType) => Promise<boolean>

  /** Dismiss the currently displayed toast without undoing (discards the
   *  undo window for its command). */
  dismissActive: () => void

  /** Silently drop a command from the queue without executing its rollback
   *  (used when the original mutation failed on the server). */
  removeCommand: (commandId: string) => void

  /** Current active undoable command for toast display. */
  activeUndo: {
    message: string
    remainingMs: number
    commandId: string
  } | null

  /** Number of pending completions in the queue (for aggregation). */
  pendingCompletions: number
}

const UndoContextImpl = createContext<UndoContext | null>(null)

// ── provider props ───────────────────────────────────────────

interface UndoProviderProps {
  children: ReactNode
  /** Current household id — queue is cleared when this changes. */
  householdId: string | undefined
  /** Called when an undo operation completes successfully. */
  onUndoComplete?: (itemName: string) => void
  /** Called when a command expires without being undone. */
  onCommandExpire?: (command: ReversibleCommand) => void
}

// ── internal command wrapper ─────────────────────────────────

interface QueuedCommand {
  command: ReversibleCommand
  /** handle returned by setTimeout — cleared on undo/expiry */
  timerId: ReturnType<typeof setTimeout> | null
  /** Whether this command has already been undone */
  undone: boolean
  /** Undo callback supplied by the mutation that created this command */
  rollback: () => Promise<void>
}

// ── provider ─────────────────────────────────────────────────

export function UndoProvider({
  children,
  householdId,
  onUndoComplete,
  onCommandExpire,
}: UndoProviderProps) {
  const queryClient = useQueryClient()
  const [activeUndo, setActiveUndo] =
    useState<UndoContext['activeUndo']>(null)
  const [pendingCompletions, setPendingCompletions] = useState(0)

  // Refs — these are never stale in callbacks.
  const queueRef = useRef<QueuedCommand[]>([])
  const householdRef = useRef(householdId)
  householdRef.current = householdId

  // ── timer management ─────────────────────────────────────

  /** Start the countdown for the next active command.
   *  Uses requestAnimationFrame so the UI smoothly decrements. */
  const rafRef = useRef<number | null>(null)

  const stopTimer = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const startTimer = useCallback(
    (commandId: string, expiryTimestamp: number) => {
      stopTimer()

      const tick = () => {
        const remainingMs = Math.max(0, expiryTimestamp - Date.now())
        if (remainingMs <= 0) {
          // Expired — remove from queue silently
          setActiveUndo(null)
          setPendingCompletions(0)

          queueRef.current = queueRef.current.filter((qc) => {
            if (qc.command.id === commandId && !qc.undone) {
              qc.command.expiryTimestamp = 0
              onCommandExpire?.(qc.command)
              return false
            }
            return true
          })

          // Show next in line if any remain
          const next = queueRef.current.find(
            (qc) => !qc.undone && qc.command.expiryTimestamp > Date.now(),
          )
          if (next) {
            setActiveUndo({
              message: next.command.userMessage,
              remainingMs: Math.max(
                0,
                next.command.expiryTimestamp - Date.now(),
              ),
              commandId: next.command.id,
            })
          }

          rafRef.current = null
          return
        }

        setActiveUndo((prev) => {
          if (prev?.commandId === commandId) {
            return { ...prev, remainingMs }
          }
          return prev
        })

        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    },
    [stopTimer, onCommandExpire],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer()
      queueRef.current.forEach((qc) => {
        if (qc.timerId) clearTimeout(qc.timerId)
      })
    }
  }, [stopTimer])

  // ── household change → clear queue ────────────────────────

  useEffect(() => {
    // Clear everything when the household changes
    stopTimer()
    queueRef.current.forEach((qc) => {
      if (qc.timerId) clearTimeout(qc.timerId)
    })
    queueRef.current = []
    setActiveUndo(null)
    setPendingCompletions(0)
  }, [householdId, stopTimer])

  // ── pushCommand ───────────────────────────────────────────

  const pushCommand = useCallback(
    (command: ReversibleCommand, customRollback?: () => Promise<void>) => {
      // Guard: only accept commands for the current household
      if (command.householdId !== householdRef.current) return

      const rollbackFn =
        customRollback ??
        (async () => {
          // Default rollback: invalidate all relevant queries
          await queryClient.invalidateQueries({
            queryKey: ['grocery-items', command.householdId],
          })
          await queryClient.invalidateQueries({
            queryKey: ['grocery-items-grouped', command.householdId],
          })
          await queryClient.invalidateQueries({
            queryKey: ['household-logs', command.householdId],
          })
          await queryClient.invalidateQueries({
            queryKey: ['frequent-items', command.householdId],
          })
          await queryClient.invalidateQueries({
            queryKey: ['quick-add-items', command.householdId],
          })
        })

      // Create wrapper
      const qc: QueuedCommand = {
        command,
        timerId: null,
        undone: false,
        rollback: rollbackFn,
      }

      // For completions: aggregate. Replace the active toast with a summary.
      if (command.type === 'completeItem') {
        // Remove any previous completion that was displayed
        queueRef.current = queueRef.current.filter(
          (q) => !(q.command.type === 'completeItem' && !q.undone),
        )
        queueRef.current.push(qc)

        const completionCount = queueRef.current.filter(
          (q) => q.command.type === 'completeItem' && !q.undone,
        ).length

        setPendingCompletions(completionCount)
        stopTimer()

        if (completionCount === 1) {
          setActiveUndo({
            message: command.userMessage,
            remainingMs: 5_000,
            commandId: command.id,
          })
        } else {
          // Aggregate: "3 items completed"
          const names = queueRef.current
            .filter((q) => q.command.type === 'completeItem' && !q.undone)
            .map((q) => q.command.itemSnapshot.name)
          const aggMessage =
            names.length > 2
              ? `${names.length} items completed — Undo all`
              : `${names.join(', ')} completed — Undo all`

          setActiveUndo({
            message: aggMessage,
            remainingMs: 5_000,
            // Use the latest command id as anchor; undoAll targets all completions
            commandId: command.id,
          })
        }

        startTimer(command.id, command.expiryTimestamp)
        return
      }

      // Non-completion: queue normally. Show one toast at a time.
      queueRef.current.push(qc)

      // If no active toast, show this one
      if (!activeUndo) {
        setActiveUndo({
          message: command.userMessage,
          remainingMs: Math.max(0, command.expiryTimestamp - Date.now()),
          commandId: command.id,
        })
        startTimer(command.id, command.expiryTimestamp)
      }
    },
    [activeUndo, startTimer, stopTimer, queryClient],
  )

  // ── undoCommand ───────────────────────────────────────────

  const undoCommand = useCallback(
    async (commandId: string): Promise<boolean> => {
      const idx = queueRef.current.findIndex(
        (qc) => qc.command.id === commandId,
      )
      if (idx === -1) return false

      const qc = queueRef.current[idx]
      if (qc.undone) return false

      qc.undone = true
      if (qc.timerId) clearTimeout(qc.timerId)

      let succeeded = false
      try {
        await qc.rollback()

        // Restore each cache key's previous data
        for (const patch of qc.command.optimisticCachePatches) {
          if (patch.data === undefined) continue // nothing to restore — refetch below
          applyCachePatch(queryClient, patch)
        }

        // Remove from queue
        queueRef.current = queueRef.current.filter(
          (q) => q.command.id !== commandId,
        )

        onUndoComplete?.(qc.command.itemSnapshot.name)
        succeeded = true
      } catch {
        // Rollback failed — keep in queue for manual retry
        qc.undone = false
      }

      // Reconcile caches with the server after a successful rollback
      if (succeeded) {
        await Promise.all(
          qc.command.optimisticCachePatches.map((patch) =>
            queryClient.invalidateQueries({ queryKey: patch.queryKey }),
          ),
        ).catch(() => {})
      }

      // Update toast state
      if (qc.command.type === 'completeItem') {
        const remaining = queueRef.current.filter(
          (q) => q.command.type === 'completeItem' && !q.undone,
        ).length
        setPendingCompletions(Math.max(0, remaining))
      }

      stopTimer()

      // Show next queued command if any
      const next = queueRef.current.find(
        (q) => !q.undone && q.command.expiryTimestamp > Date.now(),
      )

      if (next) {
        // For completions: if multiple remain, re-aggregate
        if (next.command.type === 'completeItem') {
          const compCount = queueRef.current.filter(
            (q) => q.command.type === 'completeItem' && !q.undone,
          ).length
          if (compCount > 1) {
            const names = queueRef.current
              .filter((q) => q.command.type === 'completeItem' && !q.undone)
              .map((q) => q.command.itemSnapshot.name)
            setActiveUndo({
              message:
                names.length > 2
                  ? `${names.length} items completed — Undo all`
                  : `${names.join(', ')} completed — Undo all`,
              remainingMs: Math.max(
                0,
                next.command.expiryTimestamp - Date.now(),
              ),
              commandId: next.command.id,
            })
          } else {
            setActiveUndo({
              message: next.command.userMessage,
              remainingMs: Math.max(
                0,
                next.command.expiryTimestamp - Date.now(),
              ),
              commandId: next.command.id,
            })
          }
        } else {
          setActiveUndo({
            message: next.command.userMessage,
            remainingMs: Math.max(
              0,
              next.command.expiryTimestamp - Date.now(),
            ),
            commandId: next.command.id,
          })
        }
        startTimer(next.command.id, next.command.expiryTimestamp)
      } else {
        setActiveUndo(null)
      }

      return succeeded
    },
    [stopTimer, startTimer, queryClient, onUndoComplete],
  )

  // ── undoAll ───────────────────────────────────────────────

  const undoAll = useCallback(
    async (type: CommandType): Promise<boolean> => {
      const targets = queueRef.current.filter(
        (qc) => qc.command.type === type && !qc.undone,
      )
      if (targets.length === 0) return false

      // Mark all as undone first to prevent double-undo
      targets.forEach((qc) => {
        qc.undone = true
        if (qc.timerId) clearTimeout(qc.timerId)
      })

      // Execute all rollbacks in parallel
      const results = await Promise.allSettled(
        targets.map((qc) => qc.rollback()),
      )

      // For succeeded rollbacks, remove from queue and restore cache
      targets.forEach((qc, i) => {
        if (results[i].status === 'fulfilled') {
          for (const patch of qc.command.optimisticCachePatches) {
            applyCachePatch(queryClient, patch)
          }
          queueRef.current = queueRef.current.filter(
            (q) => q.command.id !== qc.command.id,
          )
        } else {
          // Failed rollbacks stay in queue
          qc.undone = false
        }
      })

      // Update UI state
      if (type === 'completeItem') {
        const remaining = queueRef.current.filter(
          (q) => q.command.type === 'completeItem' && !q.undone,
        ).length
        setPendingCompletions(remaining)
      }

      stopTimer()
      setActiveUndo(null)

      // Show the next non-completion queued item if any
      const next = queueRef.current.find(
        (q) => !q.undone && q.command.expiryTimestamp > Date.now(),
      )
      if (next) {
        setActiveUndo({
          message: next.command.userMessage,
          remainingMs: Math.max(
            0,
            next.command.expiryTimestamp - Date.now(),
          ),
          commandId: next.command.id,
        })
        startTimer(next.command.id, next.command.expiryTimestamp)
      }

      return results.every((r) => r.status === 'fulfilled')
    },
    [stopTimer, startTimer, queryClient],
  )

  // ── removeCommand ──────────────────────────────────────────

  const removeCommand = useCallback(
    (commandId: string) => {
      queueRef.current = queueRef.current.filter(
        (qc) => qc.command.id !== commandId,
      )

      setPendingCompletions(
        queueRef.current.filter(
          (qc) => qc.command.type === 'completeItem' && !qc.undone,
        ).length,
      )

      // If the removed command was the active toast, promote the next one
      if (activeUndo?.commandId !== commandId) return

      stopTimer()
      const next = queueRef.current.find(
        (qc) => !qc.undone && qc.command.expiryTimestamp > Date.now(),
      )
      if (next) {
        setActiveUndo({
          message: next.command.userMessage,
          remainingMs: Math.max(0, next.command.expiryTimestamp - Date.now()),
          commandId: next.command.id,
        })
        startTimer(next.command.id, next.command.expiryTimestamp)
      } else {
        setActiveUndo(null)
      }
    },
    [activeUndo, stopTimer, startTimer],
  )

  // ── dismissActive ──────────────────────────────────────────

  const dismissActive = useCallback(() => {
    stopTimer()

    const activeId = activeUndo?.commandId
    const activeCmd = queueRef.current.find(
      (qc) => qc.command.id === activeId,
    )

    if (!activeCmd) {
      setActiveUndo(null)
      return
    }

    // Drop the active command (and, for aggregated completions, all
    // pending completions) without undoing.
    queueRef.current = queueRef.current.filter((qc) => {
      const isTarget =
        qc.command.id === activeId ||
        (activeCmd.command.type === 'completeItem' &&
          qc.command.type === 'completeItem')
      if (isTarget && !qc.undone) {
        qc.command.expiryTimestamp = 0
        onCommandExpire?.(qc.command)
        return false
      }
      return true
    })

    setPendingCompletions(
      queueRef.current.filter(
        (qc) => qc.command.type === 'completeItem' && !qc.undone,
      ).length,
    )

    // Promote the next queued command, if any
    const next = queueRef.current.find(
      (qc) => !qc.undone && qc.command.expiryTimestamp > Date.now(),
    )
    if (next) {
      setActiveUndo({
        message: next.command.userMessage,
        remainingMs: Math.max(0, next.command.expiryTimestamp - Date.now()),
        commandId: next.command.id,
      })
      startTimer(next.command.id, next.command.expiryTimestamp)
    } else {
      setActiveUndo(null)
    }
  }, [activeUndo, stopTimer, startTimer, onCommandExpire])

  // ── public API (stable references) ────────────────────────

  const value: UndoContext = {
    pushCommand: (command: ReversibleCommand, rollback?: () => Promise<void>) =>
      pushCommand(command, rollback),
    undoCommand,
    undoAll,
    dismissActive,
    removeCommand,
    activeUndo,
    pendingCompletions,
  }

  return (
    <UndoContextImpl.Provider value={value}>
      {children}
    </UndoContextImpl.Provider>
  )
}

// ── hook ────────────────────────────────────────────────────

export function useUndo(): UndoContext {
  const ctx = useContext(UndoContextImpl)
  if (!ctx) {
    throw new Error(
      'useUndo() must be used inside <UndoProvider>. ' +
        'Wrap part of your tree with UndoProvider from src/hooks/useUndo.',
    )
  }
  return ctx
}


