import { useRouteContext } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getCategoriesFn,
  getStoresFn,
  getGroceryItemsFn,
} from '../services/grocery.api'
import { useAddGroceryItem } from '../hooks/useAddGroceryItem'
import {
  parseAddItemInput,
  type ParsedAddItemInput,
} from '../lib/parseAddItemInput'
import type { GroceryItem } from '../lib/schemas'
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
  type: 'category' | 'store' | 'Existing Item' | 'New Item'
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
  const [cursorPosition, setCursorPosition] = useState(0)
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

  const parsed: ParsedAddItemInput = parseAddItemInput(inputValue)

  // Resolve effective metadata with precedence: explicit > DSL > default
  const effectiveQuantity = explicitQuantity !== '1' ? explicitQuantity : parsed.quantity
  const effectiveCategory = explicitCategory ?? parsed.categoryName
  const effectiveStore = explicitStore ?? parsed.storeName

  const mutation = useAddGroceryItem({
    onSuccess: (_result: GroceryItem) => {
      setInputValue('')
      setCursorPosition(0)
      setShowSuggestions(false)
      setSelectedIndex(-1)
      setError(null)
      setExplicitQuantity('1')
      setExplicitCategory(null)
      setExplicitStore(null)
      setActivePicker(null)
      onItemAdded?.({
        name: parsed.name,
        quantity: effectiveQuantity,
      })
    },
    onError: (err: Error) => {
      setError(err.message || "Couldn't add this item. Try again.")
    },
  })

  // Determine what type of suggestions to show
  const getActiveProperty = () => {
    if (cursorPosition > 0 && inputValue[cursorPosition - 1] === ' ') {
      return null
    }

    const textBeforeCursor = inputValue.substring(0, cursorPosition)
    const words = textBeforeCursor.split(/\s+/)
    const currentWord = words[words.length - 1]

    if (currentWord.startsWith('#')) {
      return { type: 'category' as const, query: currentWord.substring(1) }
    }
    if (currentWord.startsWith('@')) {
      return { type: 'store' as const, query: currentWord.substring(1) }
    }
    return null
  }

  const activeProperty = getActiveProperty()

  const getSuggestions = (): Suggestion[] => {
    if (activeProperty) {
      const { type, query } = activeProperty
      const list = type === 'category' ? categories : stores
      const matches: Suggestion[] = list
        .filter((i) =>
          i.name.toLowerCase().includes(query.toLowerCase()),
        )
        .map((i) => ({ name: i.name, type }))

      const hasExactMatch = matches.some(
        (m) => m.name.toLowerCase() === query.toLowerCase(),
      )
      if (query && !hasExactMatch) {
        matches.push({ name: query, type, isNew: true })
      }
      return matches.slice(0, 5)
    }

    if (parsed.name.length > 0) {
      const nameLower = parsed.name.toLowerCase()
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
          name: parsed.name,
          type: 'New Item' as const,
          isNew: true,
          categoryName: effectiveCategory,
          storeName: effectiveStore,
          quantity: effectiveQuantity,
        })
      }

      return matches.slice(0, 6)
    }

    return []
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

  const handlePropertyClick = (propName: string) => {
    if (!activeProperty) return
    const symbol = activeProperty.type === 'category' ? '#' : '@'
    const textBeforeCursor = inputValue.substring(0, cursorPosition)
    const textAfterCursor = inputValue.substring(cursorPosition)

    const replacement = `${symbol}${propName} `
    const newTextBefore = textBeforeCursor.replace(
      new RegExp(`${symbol}[^\\s#@]*$`),
      replacement,
    )
    const newText = newTextBefore + textAfterCursor
    const newPos = newTextBefore.length

    setInputValue(newText)
    setCursorPosition(newPos)
    setShowSuggestions(true)
    setSelectedIndex(-1)

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.selectionStart = newPos
        inputRef.current.selectionEnd = newPos
        inputRef.current.focus()
      }
    }, 0)
  }

  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (activeProperty) {
      handlePropertyClick(suggestion.name)
      return
    }

    if (suggestion.type === 'Existing Item') {
      // Re-add a historical item with explicit > DSL > item metadata precedence
      const resolvedCategoryName =
        explicitCategory ??
        parsed.categoryName ??
        (suggestion.categoryId
          ? categories.find((c) => c.id === suggestion.categoryId)?.name
          : null)

      const resolvedStoreName =
        explicitStore ??
        parsed.storeName ??
        (suggestion.storeId
          ? stores.find((s) => s.id === suggestion.storeId)?.name
          : null)

      mutation.mutate({
        name: suggestion.name,
        quantity:
          explicitQuantity !== '1'
            ? explicitQuantity
            : parsed.quantity !== '1'
              ? parsed.quantity
              : undefined,
        categoryName: resolvedCategoryName,
        storeName: resolvedStoreName,
      })
      return
    }

    // New Item
    handleSubmit()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    setTimeout(() => {
      if (inputRef.current)
        setCursorPosition(inputRef.current.selectionStart || 0)
    }, 0)

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
    if (!parsed.name) return
    setError(null)

    mutation.mutate({
      name: parsed.name,
      quantity: effectiveQuantity !== '1' ? effectiveQuantity : undefined,
      categoryName: effectiveCategory ?? undefined,
      storeName: effectiveStore ?? undefined,
    })
  }

  const isSheet = variant === 'sheet'

  // Determine chip display values
  const displayQuantity = isSheet ? effectiveQuantity : parsed.quantity
  const displayCategory = isSheet ? effectiveCategory ?? parsed.categoryName : parsed.categoryName
  const displayStore = isSheet ? effectiveStore ?? parsed.storeName : parsed.storeName

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
                setCursorPosition(e.target.selectionStart || 0)
                setShowSuggestions(true)
              }}
              onMouseUp={() =>
                setCursorPosition(inputRef.current?.selectionStart || 0)
              }
              onFocus={() => {
                setCursorPosition(inputRef.current?.selectionStart || 0)
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
            disabled={!parsed.name || mutation.isPending}
            aria-busy={mutation.isPending}
            aria-label={mutation.isPending ? 'Adding item' : 'Add item'}
          >
            {mutation.isPending && (
              <span className={styles.spinner} aria-hidden="true" />
            )}
            <span className={styles.submitButtonLabel}>Add</span>
          </button>
        </div>

        {error && (
          <div className={styles.errorMessage} role="alert">
            {error}
          </div>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div className={styles.suggestionsList}>
              {suggestions.map((s, idx) => {
                const isHighlighted = idx === selectedIndex

                if (activeProperty) {
                  const Icon =
                    activeProperty.type === 'category' ? Tag : StoreIcon
                  return (
                    <button
                      key={`${s.name}-${idx}`}
                      type="button"
                      className={`${styles.suggestionItem} ${isHighlighted ? styles.highlighted : ''}`}
                      onClick={() => handleSuggestionClick(s)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <div className={styles.suggestionMain}>
                        <Icon
                          className={styles.iconXs}
                          style={{
                            color:
                              activeProperty.type === 'category'
                                ? 'var(--accent-coral)'
                                : 'var(--accent-lavender)',
                          }}
                        />
                        <span className={styles.suggestionName}>
                          {s.name}
                        </span>
                        {s.isNew && (
                          <span className={styles.miniTag}>
                            New {activeProperty.type}
                          </span>
                        )}
                      </div>
                      <div className={styles.suggestionHint}>
                        {isHighlighted && (
                          <CornerDownLeft
                            className={styles.enterIcon}
                          />
                        )}
                      </div>
                    </button>
                  )
                }

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
                          : s.type === 'Existing Item'
                            ? 'Add again'
                            : s.type === 'category'
                              ? 'Category'
                              : s.type === 'store'
                                ? 'Store'
                                : s.type}
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
        </div>
      )}
    </div>
  )
}
