import { useCallback, useEffect, useId, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { addGroceryItemFn } from '../services/grocery.api'

/**
 * Options for useQuickAddQuantitySync.
 *
 * `onDeltaConfirmed` is called when the server successfully processes a delta.
 * The `resultingQuantity` is the full quantity on the server after the delta was
 * applied — the hook reads it from the returned GroceryItem.
 *
 * `onDeltaFailed` is called when the server request fails. The accumulator
 * can then decide whether to retry with backoff or reset the state.
 */
export interface UseQuickAddQuantitySyncOptions {
  onDeltaConfirmed: (key: string, resultingQuantity: number) => void
  onDeltaFailed: (key: string, attemptedDelta: number) => void
}

export interface QuickAddItemIdentity {
  name: string
  categoryId?: string | null
  storeId?: string | null
}

/**
 * Hook that provides a `syncDelta` function for sending accumulated tap deltas
 * to the server. It uses `addGroceryItemFn` directly (not through useMutation)
 * so multiple concurrent syncs for different items are supported.
 *
 * On success, it invalidates the relevant TanStack Query caches so the item
 * list and Quick Add templates stay in sync with the server.
 */
export function useQuickAddQuantitySync(
  options: UseQuickAddQuantitySyncOptions,
): {
  syncDelta: (
    key: string,
    itemIdentity: QuickAddItemIdentity,
    delta: number,
  ) => Promise<void>
} {
  const queryClient = useQueryClient()
  // Stable operation ID prefix so the server can deduplicate if needed in the future
  const operationIdPrefix = useId()

  // Store callbacks in refs so syncDelta stays stable even when `options`
  // changes identity on every render. This prevents cascading re-creation
  // of downstream callbacks (flush, rAF loop).
  const callbacksRef = useRef(options)
  useEffect(() => {
    callbacksRef.current = options
  })

  const syncDelta = useCallback(
    async (
      key: string,
      itemIdentity: QuickAddItemIdentity,
      delta: number,
    ): Promise<void> => {
      const operationId = `${operationIdPrefix}-${key}-${Date.now()}`
      const { onDeltaConfirmed, onDeltaFailed } = callbacksRef.current

      try {
        const result = await addGroceryItemFn({
          data: {
            name: itemIdentity.name,
            quantity: String(delta),
            categoryId: itemIdentity.categoryId ?? undefined,
            storeId: itemIdentity.storeId ?? undefined,
          },
        })

        // The server returns a GroceryItem with the updated quantity
        const resultingQuantity = parseInt(result.quantity, 10) || delta

        // Invalidate caches so the list refreshes with the new quantity
        queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
        queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
        queryClient.invalidateQueries({ queryKey: ['household-logs'] })
        queryClient.invalidateQueries({ queryKey: ['frequent-items'] })
        queryClient.invalidateQueries({ queryKey: ['quick-add-items'] })

        onDeltaConfirmed(key, resultingQuantity)
      } catch (error) {
        // Log the error for debugging; the accumulator handles retry
        console.error(
          `[QuickAdd] Sync failed for "${itemIdentity.name}" (delta=${delta}, op=${operationId}):`,
          error,
        )
        onDeltaFailed(key, delta)
      }
    },
    [queryClient, operationIdPrefix],
  )

  return { syncDelta }
}
