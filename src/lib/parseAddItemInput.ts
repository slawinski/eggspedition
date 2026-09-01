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
