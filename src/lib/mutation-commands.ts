// ── Cache patch helpers ───────────────────────────────────────
// Each factory generates a full ReversibleCommand for a specific
// mutation type. These are pure functions — no React state,
// no side-effects, fully serialisable.

import type { GroceryItem } from './schemas'
import {
  toItemSnapshot,
  type ReversibleCommand,
} from './commands'

// ── internal helpers ─────────────────────────────────────────

const QUERY_KEYS_TO_INVALIDATE = [
  ['grocery-items'],
  ['grocery-items-grouped'],
  ['household-logs'],
  ['frequent-items'],
  ['quick-add-items'],
] as const

/** Build cache patches that simply nil out the previous data for each key.
 *  The undo path restores by invalidating, not by replaying patches. */
function emptyCachePatches(
  householdId: string,
): ReversibleCommand['optimisticCachePatches'] {
  return QUERY_KEYS_TO_INVALIDATE.map((partialKey) => ({
    queryKey: [...partialKey, householdId],
    operation: 'set' as const,
    data: undefined,
  }))
}

/**
 * Build cache patches that capture the _previous_ cache state
 * for each query key from a `queryClient.getQueryData` call.
 * Callers should pass the result of `getQueryData` for each key.
 */
export function buildCachePatches(
  householdId: string,
  /** Map of queryKey serialised → previous cache data */
  previousData: Map<string, unknown>,
): ReversibleCommand['optimisticCachePatches'] {
  return QUERY_KEYS_TO_INVALIDATE.map((partialKey) => {
    const fullKey = [...partialKey, householdId]
    const key = JSON.stringify(fullKey)
    return {
      queryKey: fullKey,
      operation: 'set' as const,
      data: previousData.get(key),
    }
  })
}

// ── command factories ────────────────────────────────────────

export function createCompleteCommand(
  item: GroceryItem,
  householdId: string,
): ReversibleCommand {
  const previousSnapshot = toItemSnapshot(item)
  return {
    id: crypto.randomUUID(),
    type: 'completeItem',
    householdId,
    itemId: item.id,
    itemSnapshot: { ...previousSnapshot, checked: 'true' },
    previousSnapshot,
    optimisticCachePatches: emptyCachePatches(householdId),
    userMessage: `${item.quantity !== '1' ? `${item.quantity}× ` : ''}${item.name} completed`,
    expiryTimestamp: Date.now() + 5_000,
  }
}

export function createDeleteCommand(
  item: GroceryItem,
  householdId: string,
): ReversibleCommand {
  return {
    id: crypto.randomUUID(),
    type: 'deleteItem',
    householdId,
    itemId: item.id,
    itemSnapshot: toItemSnapshot(item),
    previousSnapshot: toItemSnapshot(item),
    optimisticCachePatches: emptyCachePatches(householdId),
    userMessage: `${item.quantity !== '1' ? `${item.quantity}× ` : ''}${item.name} deleted`,
    expiryTimestamp: Date.now() + 5_000,
  }
}

export function createRestoreCommand(
  item: GroceryItem,
  householdId: string,
): ReversibleCommand {
  const previousSnapshot = toItemSnapshot(item)
  return {
    id: crypto.randomUUID(),
    type: 'restoreItem',
    householdId,
    itemId: item.id,
    itemSnapshot: { ...previousSnapshot, checked: 'false' },
    previousSnapshot,
    optimisticCachePatches: emptyCachePatches(householdId),
    userMessage: `${item.quantity !== '1' ? `${item.quantity}× ` : ''}${item.name} restored`,
    expiryTimestamp: Date.now() + 5_000,
  }
}

export function createQuickAddCommand(
  item: GroceryItem,
  householdId: string,
): ReversibleCommand {
  return {
    id: crypto.randomUUID(),
    type: 'quickAddItem',
    householdId,
    itemId: item.id,
    itemSnapshot: toItemSnapshot(item),
    optimisticCachePatches: emptyCachePatches(householdId),
    userMessage: `${item.quantity !== '1' ? `${item.quantity}× ` : ''}${item.name} added`,
    expiryTimestamp: Date.now() + 5_000,
  }
}

export function createIncrementCommand(
  item: GroceryItem,
  householdId: string,
  newQuantity: string,
): ReversibleCommand {
  const previousSnapshot = toItemSnapshot(item)
  return {
    id: crypto.randomUUID(),
    type: 'incrementItem',
    householdId,
    itemId: item.id,
    itemSnapshot: { ...previousSnapshot, quantity: newQuantity },
    previousSnapshot,
    optimisticCachePatches: emptyCachePatches(householdId),
    userMessage: `${item.name} ×${previousSnapshot.quantity} → ×${newQuantity}`,
    expiryTimestamp: Date.now() + 5_000,
  }
}
