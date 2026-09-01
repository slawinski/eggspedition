// ── Cache patch helpers ───────────────────────────────────────
// Each factory generates a full ReversibleCommand for a specific
// mutation type. These are pure functions — no React state,
// no side-effects, fully serialisable.

import type { GroceryItem } from './schemas'
import {
  toItemSnapshot,
  type ReversibleCommand,
  type CachePatch,
} from './commands'

// ── internal helpers ─────────────────────────────────────────

const QUERY_KEYS_TO_INVALIDATE = [
  ['grocery-items'],
  ['grocery-items-grouped'],
  ['household-logs'],
] as const

/** Invalidation keys scoped to a household. The grouped key stays bare so
 *  its prefix matches both dimension variants of the real query key:
 *  ['grocery-items-grouped', 'category'|'store', householdId]. */
function invalidatedKeys(householdId: string): string[][] {
  return QUERY_KEYS_TO_INVALIDATE.map((partialKey) =>
    partialKey[0] === 'grocery-items-grouped'
      ? [...partialKey]
      : [...partialKey, householdId],
  )
}

/** Build cache patches that simply nil out the previous data for each key.
 *  The undo path restores by invalidating, not by replaying patches. */
function emptyCachePatches(
  householdId: string,
): ReversibleCommand['optimisticCachePatches'] {
  return invalidatedKeys(householdId).map((queryKey) => ({
    queryKey,
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
  return invalidatedKeys(householdId).map((queryKey) => {
    const key = JSON.stringify(queryKey)
    return {
      queryKey,
      operation: 'set' as const,
      data: previousData.get(key),
    }
  })
}

// ── Real cache patch helpers (for optimisticUpdate callbacks) ─

/** The grouped query key is ['grocery-items-grouped', 'category'|'store', hhId]
 *  — emit one patch per dimension so the undo path hits the real key. */
function groupedPatchKeys(householdId: string): string[][] {
  return [
    ['grocery-items-grouped', 'category', householdId],
    ['grocery-items-grouped', 'store', householdId],
  ]
}

export function patchCompleteInCache(
  item: GroceryItem,
  householdId: string,
): CachePatch[] {
  const itemId = item.id
  return [
    { queryKey: ['grocery-items', householdId], operation: 'update' as const, data: { id: itemId, checked: 'true' as const } },
    ...groupedPatchKeys(householdId).map((queryKey) => ({
      queryKey,
      operation: 'update' as const,
      data: { id: itemId, checked: 'true' as const },
    })),
  ]
}

export function patchDeleteFromCache(
  item: GroceryItem,
  householdId: string,
): CachePatch[] {
  return [
    { queryKey: ['grocery-items', householdId], operation: 'remove' as const, data: { id: item.id } },
    ...groupedPatchKeys(householdId).map((queryKey) => ({
      queryKey,
      operation: 'remove' as const,
      data: { id: item.id },
    })),
  ]
}

export function patchRestoreInCache(
  item: GroceryItem,
  householdId: string,
): CachePatch[] {
  const itemId = item.id
  return [
    { queryKey: ['grocery-items', householdId], operation: 'update' as const, data: { id: itemId, checked: 'false' as const } },
    ...groupedPatchKeys(householdId).map((queryKey) => ({
      queryKey,
      operation: 'update' as const,
      data: { id: itemId, checked: 'false' as const },
    })),
  ]
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
    itemSnapshot: toItemSnapshot({ ...item, checked: 'true' }), // after state
    previousSnapshot, // before state
    optimisticCachePatches: patchRestoreInCache(item, householdId), // undo → restore to unchecked
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
    itemSnapshot: toItemSnapshot(item), // before state (for restoration)
    previousSnapshot: toItemSnapshot(item),
    optimisticCachePatches: emptyCachePatches(householdId), // undo → invalidate and refetch
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
    itemSnapshot: toItemSnapshot({ ...item, checked: 'false' }), // after state
    previousSnapshot,
    optimisticCachePatches: patchCompleteInCache(item, householdId), // undo → mark checked again
    userMessage: `${item.quantity !== '1' ? `${item.quantity}× ` : ''}${item.name} restored`,
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
