import { useRouteContext } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getCategoriesFn,
  getStoresFn,
  getGroceryItemsFn,
} from '../services/grocery.api'
import { useAddGroceryItem } from '../hooks/useAddGroceryItem'
import type { GroceryItem } from '../lib/schemas'
import ManageTagsButton from './ManageTagsButton'
import styles from './AddItemForm.module.css'
import {
  Tag,
  Store as StoreIcon,
  Hash,
  CornerDownLeft,
  Sparkles,
  Minus,
  Plus,
  Search,
} from 'lucide-react'

export interface AddItemFormProps {
  variant?: 'inline' | 'sheet'
  autoFocus?: boolean
  onItemAdded?: (result: { name: string; quantity: string }) => void
  initialName?: string
  initialQuantity?: string
  initialCategory?: string
  initialStore?: string
}

type Suggestion = {
  name: string
  type: 'Existing Item' | 'New Item'
  isNew?: boolean
  categoryId?: string | null
  storeId?: string | null
  categoryName?: string | null
  storeName?: string | null
  quantity?: string | null
  id?: string
}

export default function AddItemForm({
  variant = 'inline',
  autoFocus = false,
  onItemAdded,
  initialName,
  initialQuantity,
  initialCategory,
  initialStore,
}: AddItemFormProps) {
  const { session } = useRouteContext({ from: '__root__' })
  const [inputValue, setInputValue] = useState(initialName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  // Metadata controls state
  const [activePicker, setActivePicker] = useState<
    'quantity' | 'category' | 'store' | null
  >(null)
  const [explicitQuantity, setExplicitQuantity] = useState(
    initialQuantity ?? '1',
  )
  const [explicitCategory, setExplicitCategory] = useState<
    string | null
  >(initialCategory ?? null)
  const [explicitStore, setExplicitStore] = useState<string | null>(
    initialStore ?? null,
  )
  const [pickerSearch, setPickerSearch] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', session?.householdId],
    queryFn: () => getCategoriesFn(),
    enabled: !!session?.householdId,
  })

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', session?.householdId],
    queryFn: () => getStoresFn(),
    enabled: !!session?.householdId,
  })

  // Historical items — powers the "existing item" suggestions
  const { data: groceryItems = [] } = useQuery({
    queryKey: ['grocery-items', session?.householdId],
    queryFn: () => getGroceryItemsFn(),
    enabled: !!session?.householdId,
  })

  // The input is the item name, verbatim: trimmed with collapsed spaces.
  // No #/@/xN syntax — category, store and quantity come from the pickers,
  // which accept multi-word values.
  const itemName = inputValue.trim().replace(/\s{2,}/g, ' ')

  // Effective metadata comes from the explicit picker state only.
  const effectiveQuantity = explicitQuantity
  const effectiveCategory = explicitCategory
  const effectiveStore = explicitStore

  const mutation = useAddGroceryItem({
    onSuccess: (_result: GroceryItem) => {
      setInputValue('')
      setShowSuggestions(false)
      setSelectedIndex(-1)
      setError(null)
      setExplicitQuantity('1')
      setExplicitCategory(null)
      setExplicitStore(null)
      setActivePicker(null)
      onItemAdded?.({
        name: itemName,
        quantity: effectiveQuantity,
      })
    },
    onError: (err: Error) => {
      setError(err.message || "Couldn't add this item. Try again.")
    },
  })

  const getSuggestions = (): Suggestion[] => {
    if (itemName.length === 0) return []

    const nameLower = itemName.toLowerCase()
    const matches: Suggestion[] = []
    const seen = new Set<string>()

    // Historical items: exact name match first, then newest-first
    const exact = groceryItems.filter((i) => i.name.toLowerCase() === nameLower)
    const partial = groceryItems.filter(
      (i) =>
        i.name.toLowerCase().includes(nameLower) &&
        i.name.toLowerCase() !== nameLower,
    )
    for (const item of [...exact, ...partial]) {
      const key = item.name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      matches.push({
        name: item.name,
        type: 'Existing Item',
        id: item.id,
        categoryId: item.categoryId ?? null,
        storeId: item.storeId ?? null,
        quantity: item.quantity ?? null,
      })
      if (matches.length >= 5) break
    }

    const hasExact = matches.some((m) => m.name.toLowerCase() === nameLower)
    if (!hasExact) {
      matches.push({
        name: itemName,
        type: 'New Item' as const,
        isNew: true,
        categoryName: effectiveCategory,
        storeName: effectiveStore,
        quantity: effectiveQuantity,
      })
    }

    return matches.slice(0, 6)
  }

  const suggestions = getSuggestions()

  // Auto-focus on mount when requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true })
      })
    }
  }, [autoFocus])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
        setActivePicker(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () =>
      document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setSelectedIndex(-1)
  }, [inputValue])

  // Reset picker search when picker changes
  useEffect(() => {
    setPickerSearch('')
  }, [activePicker])

  // --- Picker handlers ---

  function togglePicker(
    picker: 'quantity' | 'category' | 'store',
  ) {
    setActivePicker((prev) => (prev === picker ? null : picker))
  }

  function handleQuantityChange(value: string) {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 1) {
      setExplicitQuantity('1')
    } else {
      setExplicitQuantity(String(num))
    }
  }

  function handleCategorySelect(name: string | null) {
    setExplicitCategory(name)
    setActivePicker(null)
    setPickerSearch('')
  }

  function handleStoreSelect(name: string | null) {
    setExplicitStore(name)
    setActivePicker(null)
    setPickerSearch('')
  }

  // Filtered lists for pickers
  const filteredCategories = pickerSearch
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(pickerSearch.toLowerCase()),
      )
    : categories

  const filteredStores = pickerSearch
    ? stores.filter((s) =>
        s.name.toLowerCase().includes(pickerSearch.toLowerCase()),
      )
    : stores

  // Check if exact search match exists in the list
  const categoryExactExists =
    pickerSearch &&
    filteredCategories.some(
      (c) => c.name.toLowerCase() === pickerSearch.toLowerCase(),
    )
  const storeExactExists =
    pickerSearch &&
    filteredStores.some(
      (s) => s.name.toLowerCase() === pickerSearch.toLowerCase(),
    )

  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (suggestion.type === 'Existing Item') {
      // Re-add a historical item with explicit > item metadata precedence
      const resolvedCategoryName =
        explicitCategory ??
        (suggestion.categoryId
          ? categories.find((c) => c.id === suggestion.categoryId)?.name
          : null)

      const resolvedStoreName =
        explicitStore ??
        (suggestion.storeId
          ? stores.find((s) => s.id === suggestion.storeId)?.name
          : null)

      mutation.mutate({
        name: suggestion.name,
        quantity: explicitQuantity !== '1' ? explicitQuantity : undefined,
        categoryName: resolvedCategoryName,
        storeName: resolvedStoreName,
      })
      return
    }

    // New Item
    handleSubmit()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && inputValue.trim()) {
        handleSubmit(e)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev,
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0) {
        handleSuggestionClick(suggestions[selectedIndex])
      } else {
        handleSubmit()
      }
    } else if (e.key === 'Escape') {
      if (activePicker) {
        setActivePicker(null)
        return
      }
      setShowSuggestions(false)
    }
  }

  const handleSubmit = (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault()
    if (!itemName) return
    setError(null)

    mutation.mutate({
      name: itemName,
      quantity: effectiveQuantity !== '1' ? effectiveQuantity : undefined,
      categoryName: effectiveCategory ?? undefined,
      storeName: effectiveStore ?? undefined,
    })
  }

  const isSheet = variant === 'sheet'

  // Chip display values come from the explicit picker state.
  const displayQuantity = effectiveQuantity
  const displayCategory = effectiveCategory
  const displayStore = effectiveStore

  return (
    <div
      className={`${styles.container} ${isSheet ? styles.sheetContainer : ''}`}
      ref={containerRef}
    >
      <form onSubmit={handleSubmit} className={styles.mainForm}>
        <div className={styles.composerRow}>
          <div className={styles.inputWrapper}>
            <label htmlFor="add-item-name" className="sr-only">
              Item name
            </label>
            <input
              ref={inputRef}
              id="add-item-name"
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => {
                setShowSuggestions(true)
              }}
              onKeyDown={handleKeyDown}
              placeholder="What do you need?"
              className={styles.textInput}
              disabled={mutation.isPending}
              autoCapitalize="sentences"
              autoCorrect="on"
              autoComplete="off"
              spellCheck
              enterKeyHint="done"
            />
          </div>

          {/* Visible Add button */}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={!itemName || mutation.isPending}
            aria-busy={mutation.isPending}
            aria-label={mutation.isPending ? 'Adding item' : 'Add item'}
          >
            {mutation.isPending && (
              <span className={styles.spinner} aria-hidden="true" />
            )}
            <span className={styles.submitButtonLabel}>Add</span>
          </button>
        </div>

        {/* Inline quantity stepper (desktop form has no pickers — this
            replaces the removed xN shorthand) */}
        {!isSheet && (
          <div className={styles.inlineQuantity}>
            <span className={styles.inlineQuantityLabel}>Quantity</span>
            <div className={styles.quantityControls}>
              <button
                type="button"
                className={styles.quantityBtn}
                disabled={parseInt(effectiveQuantity, 10) <= 1}
                onClick={() =>
                  handleQuantityChange(
                    String(
                      Math.max(1, parseInt(effectiveQuantity, 10) - 1),
                    ),
                  )
                }
                aria-label="Decrease quantity"
              >
                <Minus className={styles.quantityBtnIcon} />
              </button>
              <input
                type="number"
                className={styles.quantityInput}
                value={effectiveQuantity}
                onChange={(e) =>
                  handleQuantityChange(e.target.value)
                }
                min="1"
                step="1"
                inputMode="numeric"
                aria-label="Quantity"
              />
              <button
                type="button"
                className={styles.quantityBtn}
                onClick={() =>
                  handleQuantityChange(
                    String(parseInt(effectiveQuantity, 10) + 1),
                  )
                }
                aria-label="Increase quantity"
              >
                <Plus className={styles.quantityBtnIcon} />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className={styles.errorMessage} role="alert">
            {error}
          </div>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div className={styles.suggestionsList}>
              {suggestions.map((s, idx) => {
                const isHighlighted = idx === selectedIndex

                const displayCategoryVal =
                  s.type === 'New Item'
                    ? s.categoryName
                    : s.categoryId
                      ? categories.find((c) => c.id === s.categoryId)
                          ?.name
                      : null
                const displayStoreVal =
                  s.type === 'New Item'
                    ? s.storeName
                    : s.storeId
                      ? stores.find((st) => st.id === s.storeId)
                          ?.name
                      : null
                const displayQuantityVal =
                  s.type === 'New Item' ? s.quantity : null

                return (
                  <button
                    key={`${s.name}-${idx}`}
                    type="button"
                    className={`${styles.suggestionItem} ${isHighlighted ? styles.highlighted : ''}`}
                    onClick={() => handleSuggestionClick(s)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className={styles.suggestionMain}>
                      {s.isNew && (
                        <Sparkles
                          className={styles.iconXs}
                          style={{ color: 'var(--accent-coral)' }}
                        />
                      )}
                      <span className={styles.suggestionName}>
                        {s.name}
                      </span>

                      <div className={styles.suggestionDetails}>
                        {displayQuantityVal &&
                          displayQuantityVal !== '1' && (
                            <span
                              className={`${styles.miniTag} ${styles.miniTagQuantity}`}
                            >
                              <Hash
                                className={styles.miniTagIcon}
                              />{' '}
                              {displayQuantityVal}
                            </span>
                          )}
                        {displayCategoryVal && (
                          <span
                            className={`${styles.miniTag} ${styles.miniTagCategory}`}
                          >
                            <Tag className={styles.miniTagIcon} />{' '}
                            {displayCategoryVal}
                          </span>
                        )}
                        {displayStoreVal && (
                          <span
                            className={`${styles.miniTag} ${styles.miniTagStore}`}
                          >
                            <StoreIcon
                              className={styles.miniTagIcon}
                            />{' '}
                            {displayStoreVal}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={styles.suggestionHint}>
                      <span className={styles.suggestionType}>
                        {s.type === 'New Item'
                          ? 'Add new item'
                          : 'Add again'}
                      </span>
                      {isHighlighted && (
                        <CornerDownLeft
                          className={styles.enterIcon}
                        />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
      </form>

      {/* ---- Metadata controls (sheet mode only) ---- */}
      {isSheet && (
        <div className={styles.metadataRow}>
          <button
            type="button"
            className={`${styles.metadataChip} ${activePicker === 'quantity' ? styles.metadataChipActive : ''} ${explicitQuantity !== '1' ? styles.metadataChipSet : ''}`}
            onClick={() => togglePicker('quantity')}
            aria-expanded={activePicker === 'quantity'}
          >
            <Hash className={styles.metadataChipIcon} />
            {displayQuantity} item{displayQuantity !== '1' ? 's' : ''}
          </button>

          <button
            type="button"
            className={`${styles.metadataChip} ${activePicker === 'category' ? styles.metadataChipActive : ''} ${displayCategory ? styles.metadataChipSet : ''}`}
            onClick={() => togglePicker('category')}
            aria-expanded={activePicker === 'category'}
          >
            <Tag className={styles.metadataChipIcon} />
            {displayCategory || 'Category'}
          </button>

          <button
            type="button"
            className={`${styles.metadataChip} ${activePicker === 'store' ? styles.metadataChipActive : ''} ${displayStore ? styles.metadataChipSet : ''}`}
            onClick={() => togglePicker('store')}
            aria-expanded={activePicker === 'store'}
          >
            <StoreIcon className={styles.metadataChipIcon} />
            {displayStore || 'Store'}
          </button>
        </div>
      )}

      {/* ---- Quantity Picker ---- */}
      {isSheet && activePicker === 'quantity' && (
        <div className={styles.pickerPanel}>
          <div className={styles.quantityControls}>
            <button
              type="button"
              className={styles.quantityBtn}
              disabled={parseInt(effectiveQuantity, 10) <= 1}
              onClick={() =>
                handleQuantityChange(
                  String(
                    Math.max(1, parseInt(effectiveQuantity, 10) - 1),
                  ),
                )
              }
              aria-label="Decrease quantity"
            >
              <Minus className={styles.quantityBtnIcon} />
            </button>
            <input
              type="number"
              className={styles.quantityInput}
              value={effectiveQuantity}
              onChange={(e) =>
                handleQuantityChange(e.target.value)
              }
              min="1"
              step="1"
              inputMode="numeric"
              aria-label="Quantity"
            />
            <button
              type="button"
              className={styles.quantityBtn}
              onClick={() =>
                handleQuantityChange(
                  String(parseInt(effectiveQuantity, 10) + 1),
                )
              }
              aria-label="Increase quantity"
            >
              <Plus className={styles.quantityBtnIcon} />
            </button>
          </div>
        </div>
      )}

      {/* ---- Category Picker ---- */}
      {isSheet && activePicker === 'category' && (
        <div className={styles.pickerPanel}>
          <div className={styles.pickerSearch}>
            <Search className={styles.pickerSearchIcon} />
            <input
              type="text"
              className={styles.pickerSearchInput}
              placeholder="Search categories"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.pickerOptions}>
            <button
              type="button"
              className={`${styles.pickerOption} ${!explicitCategory ? styles.pickerOptionSelected : ''}`}
              onClick={() => handleCategorySelect(null)}
            >
              <span
                className={`${styles.pickerRadio} ${!explicitCategory ? styles.pickerRadioChecked : ''}`}
              />
              No category
            </button>
            {filteredCategories.slice(0, 8).map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.pickerOption} ${explicitCategory === cat.name ? styles.pickerOptionSelected : ''}`}
                onClick={() => handleCategorySelect(cat.name)}
              >
                <span
                  className={`${styles.pickerRadio} ${explicitCategory === cat.name ? styles.pickerRadioChecked : ''}`}
                />
                {cat.name}
              </button>
            ))}
            {pickerSearch &&
              !categoryExactExists &&
              pickerSearch.trim() && (
                <button
                  type="button"
                  className={`${styles.pickerOption} ${styles.pickerOptionNew}`}
                  onClick={() =>
                    handleCategorySelect(pickerSearch.trim())
                  }
                >
                  <Plus className={styles.pickerNewIcon} />
                  Create "{pickerSearch.trim()}"
                </button>
              )}
          </div>
          <ManageTagsButton label="Manage categories" />
        </div>
      )}

      {/* ---- Store Picker ---- */}
      {isSheet && activePicker === 'store' && (
        <div className={styles.pickerPanel}>
          <div className={styles.pickerSearch}>
            <Search className={styles.pickerSearchIcon} />
            <input
              type="text"
              className={styles.pickerSearchInput}
              placeholder="Search stores"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.pickerOptions}>
            <button
              type="button"
              className={`${styles.pickerOption} ${!explicitStore ? styles.pickerOptionSelected : ''}`}
              onClick={() => handleStoreSelect(null)}
            >
              <span
                className={`${styles.pickerRadio} ${!explicitStore ? styles.pickerRadioChecked : ''}`}
              />
              No store
            </button>
            {filteredStores.slice(0, 8).map((store) => (
              <button
                key={store.id}
                type="button"
                className={`${styles.pickerOption} ${explicitStore === store.name ? styles.pickerOptionSelected : ''}`}
                onClick={() => handleStoreSelect(store.name)}
              >
                <span
                  className={`${styles.pickerRadio} ${explicitStore === store.name ? styles.pickerRadioChecked : ''}`}
                />
                {store.name}
              </button>
            ))}
            {pickerSearch &&
              !storeExactExists &&
              pickerSearch.trim() && (
                <button
                  type="button"
                  className={`${styles.pickerOption} ${styles.pickerOptionNew}`}
                  onClick={() =>
                    handleStoreSelect(pickerSearch.trim())
                  }
                >
                  <Plus className={styles.pickerNewIcon} />
                  Create "{pickerSearch.trim()}"
                </button>
              )}
          </div>
          <ManageTagsButton label="Manage stores" />
        </div>
      )}
    </div>
  )
}
