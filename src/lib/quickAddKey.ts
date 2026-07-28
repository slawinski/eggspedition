/**
 * Stable key utilities for Quick Add item identity.
 *
 * Problem: The existing QuickAdd keys state by `item.name`, which means two
 * templates with the same name but different IDs/metadata (e.g. "Coffee" with
 * store "Costco" vs "Coffee" with store "Trader Joe's") share state incorrectly.
 *
 * Solution: A stable key built from the most specific identity available.
 * Priority: active grocery item ID > template ID > normalized composite key.
 */

/**
 * Returns a stable, unique key for a Quick Add item.
 *
 * Priority chain (first available wins):
 *   1. Active grocery item ID (already on the list)
 *   2. Template ID (from quick_add_items table)
 *   3. Normalized composite: name + categoryId + storeId
 *
 * This ensures two templates with the same name but different store/category
 * metadata are treated as distinct items.
 */
export function getQuickAddKey(item: {
  groceryItemId?: string
  templateId?: string
  name: string
  categoryId?: string | null
  storeId?: string | null
}): string {
  // 1. Active grocery item — most specific
  if (item.groceryItemId) {
    return `gi:${item.groceryItemId}`
  }

  // 2. Template — stable across sessions
  if (item.templateId) {
    return `tpl:${item.templateId}`
  }

  // 3. Composite fallback — distinct enough for unnamed items
  const name = normalizeItemName(item.name)
  const cat = item.categoryId ?? '_'
  const store = item.storeId ?? '_'
  return `cmp:${name}|${cat}|${store}`
}

/**
 * Normalize an item name for identity comparison.
 *
 * Applies in order:
 *   1. Trim leading/trailing whitespace
 *   2. Unicode NFC normalization (combines diacritics, normalizes code points)
 *   3. Locale-aware case folding (en-US lowercasing)
 *
 * Two strings that refer to the same logical item should normalize to the same
 * value regardless of Unicode representation or casing differences.
 */
export function normalizeItemName(name: string): string {
  return name
    .trim()
    .normalize('NFC')
    .toLocaleLowerCase('en-US')
}
