// ── Undo toast management ────────────────────────────────────
// Reads from UndoContext and renders a single toast at a time.
//
// • Completable items aggregate: "3 items completed — Undo all"
// • Deletions and other mutations are individually reversible.
// • Toast auto-dismisses after the undo window expires.
// • Completable-item toast uses role="status" (non-disruptive).
// • Deletion toast uses role="alert" (destructive action).
// • Briefly shows an "Undone" confirmation after undo.

import { useEffect, useState, useRef, useCallback } from 'react'
import { useUndo } from './useUndo'
import type { CommandType } from '../lib/commands'

// ── types ────────────────────────────────────────────────────

export interface UndoToastState {
  /** Whether the toast is currently visible */
  visible: boolean
  /** The toast message */
  message: string
  /** Whether this is an "Undone" confirmation (shown briefly after undo) */
  isUndone: boolean
  /** Whether the operation is destructive (delete) — uses role="alert" */
  isDestructive: boolean
  /** The command id to undo, or undefined for aggregate completions */
  commandId: string | undefined
  /** Command type for aggregate undo */
  commandType: CommandType | undefined
  /** Use "status" (default) or "alert" role */
  role: 'status' | 'alert'
  /** Call to execute undo */
  onUndo: () => void
  /** Call to dismiss the toast */
  onDismiss: () => void
}

// ── hook ─────────────────────────────────────────────────────

export function useUndoToast(): UndoToastState {
  const { activeUndo, pendingCompletions, undoCommand, undoAll } = useUndo()
  const [undoneMessage, setUndoneMessage] = useState<string | null>(null)
  const undoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear "Undone" message after 2 seconds
  const clearUndone = useCallback(() => {
    if (undoneTimerRef.current) {
      clearTimeout(undoneTimerRef.current)
    }
    setUndoneMessage(null)
  }, [])

  const handleUndo = useCallback(() => {
    const cmdId = activeUndo?.commandId
    if (!cmdId) return

    // Aggregate completions: undoAll, show "Undone"
    if (pendingCompletions > 1) {
      const undoneCount = pendingCompletions
      undoAll('completeItem')
      setUndoneMessage(`${undoneCount} items restored`)
    } else {
      // Single undo or non-completion type
      undoCommand(cmdId)
      const msg = activeUndo?.message ?? 'Undone'
      setUndoneMessage(msg.replace(/ completed$/, '').replace(/ deleted$/, '').replace(/ added$/, '') + ' undone')
    }

    // Clear undone message after 2 s
    if (undoneTimerRef.current) clearTimeout(undoneTimerRef.current)
    undoneTimerRef.current = setTimeout(() => {
      setUndoneMessage(null)
    }, 2_000)
  }, [activeUndo, pendingCompletions, undoCommand, undoAll])

  const handleDismiss = useCallback(() => {
    clearUndone()
  }, [clearUndone])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (undoneTimerRef.current) clearTimeout(undoneTimerRef.current)
    }
  }, [])

  // If we just showed "Undone", display that briefly
  if (undoneMessage) {
    return {
      visible: true,
      message: undoneMessage,
      isUndone: true,
      isDestructive: false,
      commandId: undefined,
      commandType: undefined,
      role: 'status',
      onUndo: () => {},
      onDismiss: clearUndone,
    }
  }

  // No active toast
  if (!activeUndo) {
    return {
      visible: false,
      message: '',
      isUndone: false,
      isDestructive: false,
      commandId: undefined,
      commandType: undefined,
      role: 'status',
      onUndo: () => {},
      onDismiss: () => {},
    }
  }

  // Determine if this is a destructive (delete) operation
  // We detect it by checking the userMessage for "deleted"
  const isDestructive = activeUndo.message.toLowerCase().includes('deleted')
  const role: 'status' | 'alert' = isDestructive ? 'alert' : 'status'

  return {
    visible: true,
    message: activeUndo.message,
    isUndone: false,
    isDestructive,
    commandId: activeUndo.commandId,
    commandType: pendingCompletions > 1 ? 'completeItem' : undefined,
    role,
    onUndo: handleUndo,
    onDismiss: handleDismiss,
  }
}
