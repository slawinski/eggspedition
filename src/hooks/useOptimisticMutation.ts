// ── Shared optimistic mutation hook ──────────────────────────
// Wraps TanStack Query's useMutation with a standardised
// optimistic-update / rollback pattern.
//
// Callers provide:
//  • mutationFn     – the actual server mutation
//  • optimisticUpdate – returns an array of { previousData, queryKey }
//                       for every cache key mutated optimistically
//  • rollback        – restores previousData to each query key
//  • commandFactory  – builds a ReversibleCommand so the undo
//                       system can later roll the operation back
//
// The hook handles:
//  • Saving previous cache state  via  queryClient.getQueryData
//  • Applying optimistic patches  via  queryClient.setQueryData
//  • Rolling back on error        via  queryClient.setQueryData
//  • Invalidating on success      via  queryClient.invalidateQueries
//  • Pushing an undo command      via  the UndoProvider context

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import type { ReversibleCommand } from '../lib/commands'
import { useUndo } from './useUndo'

// ── types ────────────────────────────────────────────────────

export interface OptimisticMutationConfig<TData, TVariables> {
  /** The server mutation function. */
  mutationFn: (vars: TVariables) => Promise<TData>

  /**
   * Given the mutation variables, return the optimistic cache patches
   * and the previous data for each query key that will be touched.
   * Called inside onMutate.
   */
  optimisticUpdate?: (
    vars: TVariables,
  ) => { previousData: unknown; patch: (prev: unknown) => unknown; queryKey: string[] }[]

  /**
   * Called on error to roll back the optimistic patches.
   * Receives the snapshot of each touched cache key.
   */
  rollback?: (context: { previousData: unknown; queryKey: string[] }[]) => void

  /** Query keys to invalidate after success. */
  invalidationKeys?: string[][]

  /** Called after a successful mutation + invalidation. */
  onSuccess?: (data: TData, vars: TVariables) => void

  /** Called when the mutation fails. */
  onError?: (error: Error, vars: TVariables) => void

  /**
   * Build a ReversibleCommand so the undo toast system can
   * offer a "Undo" button.  Receives the server-returned data
   * (which contains the final item state) and the mutation variables.
   */
  commandFactory?: (
    /** The item returned by the server (or variables if none) */
    result: TData,
    /** The mutation variables */
    vars: TVariables,
  ) => ReversibleCommand | null

  /**
   * Custom rollback function for the undo system.
   * When provided, `commandFactory` must also be present.
   * Receives the mutation variables and the queued command (whose
   * snapshots hold the pre-mutation item state) so the undo path can
   * call the inverse server endpoint.
   */
  undoRollback?: (vars: TVariables, command: ReversibleCommand) => Promise<void>
}

// ── hook ─────────────────────────────────────────────────────

export function useOptimisticMutation<TData, TVariables>(
  config: OptimisticMutationConfig<TData, TVariables>,
) {
  const queryClient = useQueryClient()
  const undo = useUndo()

  const configRef = useRef(config)
  configRef.current = config

  // Build the rollback context by reading current cache values
  // BEFORE the mutation runs.
  const buildRollbackContext = useCallback(
    (vars: TVariables) => {
      if (!configRef.current.optimisticUpdate) return []

      const patches = configRef.current.optimisticUpdate(vars)
      return patches.map((patch) => ({
        previousData: queryClient.getQueryData(patch.queryKey),
        queryKey: patch.queryKey,
        patch: patch.patch,
      }))
    },
    [queryClient],
  )

  // Apply optimistic patches to the cache
  const applyOptimistic = useCallback(
    (
      snapshots: {
        previousData: unknown
        queryKey: string[]
        patch: (prev: unknown) => unknown
      }[],
    ) => {
      for (const snapshot of snapshots) {
        queryClient.setQueryData(
          snapshot.queryKey,
          snapshot.patch(snapshot.previousData),
        )
      }
    },
    [queryClient],
  )

  // Restore previous cache values on error
  const rollbackOptimistic = useCallback(
    (
      snapshots: {
        previousData: unknown
        queryKey: string[]
        patch: (prev: unknown) => unknown
      }[],
    ) => {
      if (configRef.current.rollback) {
        configRef.current.rollback(
          snapshots.map(({ previousData, queryKey }) => ({
            previousData,
            queryKey,
          })),
        )
      } else {
        for (const snapshot of snapshots) {
          queryClient.setQueryData(snapshot.queryKey, snapshot.previousData)
        }
      }
    },
    [queryClient],
  )

  // Invalidate keys on success
  const invalidateOnSuccess = useCallback(async () => {
    const keys = configRef.current.invalidationKeys ?? []
    await Promise.all(
      keys.map((key) => queryClient.invalidateQueries({ queryKey: key })),
    )
  }, [queryClient])

  return useMutation({
    mutationFn: config.mutationFn,

    onMutate: async (vars: TVariables) => {
      // Cancel any in-flight queries so they don't overwrite our optimistic data
      const invalidationKeys = configRef.current.invalidationKeys ?? []
      const allKeys = new Set(
        invalidationKeys.map((k) => JSON.stringify(k)),
      )

      if (configRef.current.optimisticUpdate) {
        const patches = configRef.current.optimisticUpdate(vars)
        for (const patch of patches) {
          allKeys.add(JSON.stringify(patch.queryKey))
        }
      }

      // Cancel queries for all affected keys
      await Promise.all(
        [...allKeys].map(
          (keyStr) =>
            queryClient.cancelQueries({
              queryKey: JSON.parse(keyStr),
            }) as Promise<void>,
        ),
      )

      // Snapshot & apply optimistic updates
      const snapshots = buildRollbackContext(vars)
      applyOptimistic(snapshots)

      // Build optimistic command and push to undo queue immediately
      let optimisticCommand: ReversibleCommand | null = null
      if (configRef.current.commandFactory) {
        optimisticCommand = configRef.current.commandFactory(null as any, vars)
        if (optimisticCommand) {
          const command = optimisticCommand
          const rollbackFn = configRef.current.undoRollback
            ? () => configRef.current.undoRollback!(vars, command)
            : undefined
          undo.pushCommand(command, rollbackFn)
        }
      }

      return { snapshots, vars, optimisticCommand }
    },

    onError: (error: Error, vars: TVariables, context: unknown) => {
      const ctx = context as
        | { snapshots: ReturnType<typeof buildRollbackContext>; vars: TVariables; optimisticCommand?: ReversibleCommand | null }
        | undefined
      if (ctx?.snapshots?.length) {
        rollbackOptimistic(ctx.snapshots)
      }
      // Remove the optimistic command from the undo queue since mutation failed
      if (ctx?.optimisticCommand) {
        undo.removeCommand(ctx.optimisticCommand.id)
      }
      configRef.current.onError?.(error, vars)
    },

    onSuccess: async (data: TData, vars: TVariables, _context: unknown) => {
      // Invalidate affected keys so TanStack refetches fresh data
      await invalidateOnSuccess()

      // Command was already pushed to undo queue in onMutate — no need to push again

      configRef.current.onSuccess?.(data, vars)
    },
  })
}
