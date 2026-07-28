export interface ParsedAddItemInput {
  name: string
  quantity: string
  categoryName: string | null
  storeName: string | null
}

export function parseAddItemInput(input: string): ParsedAddItemInput {
  const categoryMatch = input.match(/#([^\s#@]+)/)
  const storeMatch = input.match(/@([^\s#@]+)/)
  const quantityMatch =
    input.match(/\s[x*](\d+)/) ?? input.match(/^(\d+)\s/)

  const categoryName = categoryMatch ? categoryMatch[1] : null
  const storeName = storeMatch ? storeMatch[1] : null
  let quantity = quantityMatch ? quantityMatch[1] : '1'

  // Clamp invalid quantities
  const quantityNum = parseInt(quantity, 10)
  if (isNaN(quantityNum) || quantityNum < 1) {
    quantity = '1'
  }

  let name = input
    .replace(/#[^\s#@]+/, '')
    .replace(/@[^\s#@]+/, '')
    .replace(/\s[x*]\d+/, '')
    .replace(/^\d+\s/, '')
    .trim()
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')

  return { name, quantity, categoryName, storeName }
}

// ---------------------------------------------------------------------------
// Suggestion ranking for the composer
// ---------------------------------------------------------------------------

export interface RankedSuggestion {
  name: string
  type: 'category' | 'store' | 'Quick Add' | 'New Item' | 'Existing Item'
  isNew?: boolean
  categoryId?: string | null
  storeId?: string | null
  categoryName?: string | null
  storeName?: string | null
  quantity?: string | null
  id?: string
  currentQuantity?: string // For existing unchecked items
  rank: number // Lower = better
}

export function rankSuggestions(
  _input: string,
  quickAddItems: any[],
  uncheckedItems: any[],
  _categories: any[],
  _stores: any[],
  parsed: ParsedAddItemInput,
): RankedSuggestion[] {
  const nameLower = parsed.name.toLowerCase()
  if (!nameLower) return []

  const results: RankedSuggestion[] = []
  const addedNames = new Set<string>()

  // --- Rank 0: Exact unchecked-list match ---
  const exactUnchecked = uncheckedItems.filter(
    (i) => i.name.toLowerCase() === nameLower,
  )
  for (const item of exactUnchecked) {
    if (addedNames.has(item.name.toLowerCase())) continue
    addedNames.add(item.name.toLowerCase())
    results.push({
      name: item.name,
      type: 'Existing Item',
      id: item.id,
      categoryId: item.categoryId ?? null,
      storeId: item.storeId ?? null,
      quantity: item.quantity ?? null,
      currentQuantity: item.quantity ?? null,
      categoryName: item.categoryName ?? null,
      storeName: item.storeName ?? null,
      rank: 0,
    })
  }

  // --- Rank 1: Quick Add template exact match ---
  const exactQuickAdd = quickAddItems.filter(
    (i) => i.name.toLowerCase() === nameLower,
  )
  for (const template of exactQuickAdd) {
    if (addedNames.has(template.name.toLowerCase())) continue
    addedNames.add(template.name.toLowerCase())
    results.push({
      name: template.name,
      type: 'Quick Add',
      id: template.id,
      categoryId: template.categoryId ?? null,
      storeId: template.storeId ?? null,
      categoryName: template.categoryName ?? null,
      storeName: template.storeName ?? null,
      quantity: template.quantity ?? null,
      rank: 1,
    })
  }

  // --- Rank 2: Quick Add template partial match (not already exact) ---
  const partialQuickAdd = quickAddItems.filter(
    (i) =>
      i.name.toLowerCase().includes(nameLower) &&
      !addedNames.has(i.name.toLowerCase()),
  )
  for (const template of partialQuickAdd.slice(0, 6)) {
    if (addedNames.has(template.name.toLowerCase())) continue
    addedNames.add(template.name.toLowerCase())
    results.push({
      name: template.name,
      type: 'Quick Add',
      id: template.id,
      categoryId: template.categoryId ?? null,
      storeId: template.storeId ?? null,
      categoryName: template.categoryName ?? null,
      storeName: template.storeName ?? null,
      quantity: template.quantity ?? null,
      rank: 2,
    })
  }

  // --- Rank 3: New Item (plain typed value) ---
  if (!addedNames.has(nameLower)) {
    results.push({
      name: parsed.name,
      type: 'New Item',
      isNew: true,
      categoryName: parsed.categoryName ?? null,
      storeName: parsed.storeName ?? null,
      quantity: parsed.quantity ?? null,
      rank: 3,
    })
  }

  return results
}
