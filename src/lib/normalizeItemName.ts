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
