// ── Grouped-cache patch helpers ───────────────────────────────
// Pure functions used by SmartView's move mutation to optimistically
// relocate an item between groups in the TanStack Query cache.
//
// The grouped cache shape (from grocery.service.getGroceryItemsGrouped):
//   Record<groupId, { category?: { name } | store?: { name }; items: GroceryItem[] }>
// where groupId is a category/store uuid, or 'unassigned' for null ids.

export interface ItemMoveVars {
  id: string
  data: {
    categoryId?: string | null
    storeId?: string | null
  }
}

/** The dimension of a move is inferred from which field is present. */
export function moveDimension(move: ItemMoveVars): 'category' | 'store' | null {
  if (move.data.categoryId !== undefined) return 'category'
  if (move.data.storeId !== undefined) return 'store'
  return null
}

function withMoveFields<T extends { id: string }>(item: T, move: ItemMoveVars): T {
  const fields: Record<string, unknown> = {}
  if (move.data.categoryId !== undefined) fields.categoryId = move.data.categoryId
  if (move.data.storeId !== undefined) fields.storeId = move.data.storeId
  return { ...item, ...fields } as T
}

/**
 * Remove the item from its current group and insert the updated copy into
 * the target group, keeping the group sorted by createdAt DESC (the server
 * order) so the item doesn't jump position after the post-move refetch.
 * Returns the previous value untouched if the item isn't found.
 */
export function moveItemBetweenGroups(
  prev: unknown,
  move: ItemMoveVars,
): unknown {
  if (!prev || typeof prev !== 'object' || Array.isArray(prev)) return prev

  const dimension = moveDimension(move)
  if (!dimension) return prev

  const groups = prev as Record<string, { items?: unknown[]; [k: string]: unknown }>
  const result: Record<string, unknown> = { ...groups }

  let movedItem: unknown = null
  for (const key of Object.keys(result)) {
    const group = result[key] as { items?: unknown[]; [k: string]: unknown } | undefined
    if (!group || !Array.isArray(group.items)) continue
    const idx = group.items.findIndex((i) => (i as { id?: string })?.id === move.id)
    if (idx === -1) continue

    movedItem = withMoveFields(group.items[idx] as { id: string }, move)
    result[key] = {
      ...group,
      items: group.items.filter((i) => (i as { id?: string })?.id !== move.id),
    }
    break
  }

  if (!movedItem) return prev

  const targetValue = dimension === 'category' ? move.data.categoryId : move.data.storeId
  const targetKey = targetValue || 'unassigned'

  const target = result[targetKey] as { items?: unknown[]; [k: string]: unknown } | undefined
  const targetItems = target && Array.isArray(target.items) ? target.items : []
  const merged = [movedItem, ...targetItems]
  // Server orders by createdAt DESC — mirror it so the optimistic position
  // survives the refetch. Items without timestamps keep their relative
  // order (sort is stable), so the moved item stays first in that case.
  const sorted = merged.sort((a, b) => {
    const ta = (a as { createdAt?: string }).createdAt
    const tb = (b as { createdAt?: string }).createdAt
    if (!ta || !tb) return 0
    return new Date(tb).getTime() - new Date(ta).getTime()
  })

  result[targetKey] = { ...(target ?? {}), items: sorted }

  return result
}

/** Update the item's fields inside a flat array cache (grocery-items). */
export function updateItemInList(prev: unknown, move: ItemMoveVars): unknown {
  if (!Array.isArray(prev)) return prev
  return prev.map((i) => {
    const item = i as { id?: string }
    return item?.id === move.id ? withMoveFields(item as { id: string }, move) : i
  })
}
