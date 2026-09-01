// ── Undo architecture: typed reversible commands ──
// Every mutation that supports undo produces a ReversibleCommand
// containing enough serialisable state to roll the operation back.

import type { GroceryItem } from './schemas'

export type CommandType =
  | 'completeItem'
  | 'restoreItem'
  | 'deleteItem'
  | 'incrementItem'

/**
 * A snapshot of a grocery item's key fields — fully serialisable,
 * never references React state or mutable objects.
 * Mirrors the shape of GroceryItem but strips DB-only fields
 * (id, createdAt, updatedAt, userId) that aren't needed for undo.
 */
export interface ItemSnapshot {
  name: string
  quantity: string
  categoryId?: string | null
  storeId?: string | null
  checked: 'true' | 'false'
}

/**
 * Records a cache mutation made during an optimistic update
 * so the undo system can roll the cache back to its previous state.
 *
 * `data` holds the **previous** cache value for the given query key
 * (the state before the optimistic patch was applied).
 */
export interface CachePatch {
  /** The TanStack Query cache key that was (or will be) mutated. */
  queryKey: string[]
  /** Always 'set' in practice — we record the previous data
   *  so undo can restore it via queryClient.setQueryData. */
  operation: 'set' | 'remove' | 'update'
  /** The previous cache value for this query key (or the deleted item). */
  data?: unknown
}

/**
 * A fully reversible operation.
 *
 * - `itemSnapshot` captures the _new_ state (after the mutation).
 * - `previousSnapshot` captures the _old_ state (before the mutation),
 *   which is what the undo path replays.
 * - `optimisticCachePatches` records every cache key that was touched
 *   so the undo path can restore the previous data.
 */
export interface ReversibleCommand {
  /** Unique operation id — crypto.randomUUID() */
  id: string
  /** What kind of operation this was */
  type: CommandType
  /** The household the item belongs to */
  householdId: string
  /** The grocery item's id */
  itemId: string
  /** Full item state after the mutation */
  itemSnapshot: ItemSnapshot
  /** Full item state before the mutation (used by undo) */
  previousSnapshot?: ItemSnapshot
  /** Cache keys + previous data to restore on undo */
  optimisticCachePatches: CachePatch[]
  /** Human-readable toast message, e.g. "Milk completed" */
  userMessage: string
  /** Date.now() + 5000 */
  expiryTimestamp: number
}

// ── helpers ──────────────────────────────────────────────────

/** Build an ItemSnapshot from a GroceryItem (server-returned shape). */
export function toItemSnapshot(item: GroceryItem): ItemSnapshot {
  return {
    name: item.name,
    quantity: item.quantity,
    categoryId: item.categoryId ?? null,
    storeId: item.storeId ?? null,
    checked: item.checked as 'true' | 'false',
  }
}
