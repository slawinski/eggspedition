import { useRouteContext } from '@tanstack/react-router'
import { useState, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getCategoriesFn,
  getStoresFn,
} from '../services/grocery.api'
import { useAddGroceryItem } from '../hooks/useAddGroceryItem'
import {
  parseAddItemInput,
  type ParsedAddItemInput,
} from '../lib/parseAddItemInput'
import type { GroceryItem } from '../lib/schemas'

export type Suggestion = {
  name: string
  type: 'category' | 'store' | 'New Item'
  isNew?: boolean
  categoryId?: string | null
  storeId?: string | null
  categoryName?: string | null
  storeName?: string | null
  quantity?: string | null
  id?: string
}

export interface ComposerState {
  inputValue: string
  cursorPosition: number
  showSuggestions: boolean
  selectedIndex: number
  activePicker: 'quantity' | 'category' | 'store' | null
  explicitQuantity: string
  explicitCategory: string | null
  explicitStore: string | null
  pickerSearch: string
  error: string | null
  isPending: boolean
}

export interface UseAddItemComposerOptions {
  onSuccess?: (result: { name: string; quantity: string }) => void
}

export function useAddItemComposer(options?: UseAddItemComposerOptions) {
  const { session } = useRouteContext({ from: '__root__' })

  const [inputValue, setInputValue] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [activePicker, setActivePicker] = useState<
    'quantity' | 'category' | 'store' | null
  >(null)
  const [explicitQuantity, setExplicitQuantity] = useState('1')
  const [explicitCategory, setExplicitCategory] = useState<
    string | null
  >(null)
  const [explicitStore, setExplicitStore] = useState<string | null>(
    null,
  )
  const [pickerSearch, setPickerSearch] = useState('')

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

  const parsed: ParsedAddItemInput = parseAddItemInput(inputValue)

  // Resolve effective metadata with precedence: explicit > DSL > default
  const effectiveQuantity =
    explicitQuantity !== '1' ? explicitQuantity : parsed.quantity
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
      options?.onSuccess?.({
        name: parsed.name,
        quantity: effectiveQuantity,
      })
    },
    onError: (err: Error) => {
      setError(err.message || "Couldn't add this item. Try again.")
    },
  })

  // Determine what type of suggestions to show (property-based vs name-based)
  const activeProperty = useMemo(() => {
    if (cursorPosition > 0 && inputValue[cursorPosition - 1] === ' ') {
      return null
    }

    const textBeforeCursor = inputValue.substring(0, cursorPosition)
    const words = textBeforeCursor.split(/\s+/)
    const currentWord = words[words.length - 1]

    if (currentWord.startsWith('#')) {
      return {
        type: 'category' as const,
        query: currentWord.substring(1),
      }
    }
    if (currentWord.startsWith('@')) {
      return { type: 'store' as const, query: currentWord.substring(1) }
    }
    return null
  }, [inputValue, cursorPosition])

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
      const suggestions: Suggestion[] = []

      suggestions.push({
        name: parsed.name,
        type: 'New Item' as const,
        isNew: true,
        categoryName: effectiveCategory,
        storeName: effectiveStore,
        quantity: effectiveQuantity,
      })

      return suggestions.slice(0, 6)
    }

    return []
  }

  const suggestions = getSuggestions()

  // --- Picker handlers ---

  function togglePicker(picker: 'quantity' | 'category' | 'store') {
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

  function handlePropertyClick(propName: string) {
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
  }

  function handleSuggestionClick(suggestion: Suggestion) {
    if (activeProperty) {
      handlePropertyClick(suggestion.name)
      return
    }

    // Only "New Item" suggestions reach this branch
    handleSubmit()
  }

  function handleSubmit() {
    if (!parsed.name) return
    setError(null)

    mutation.mutate({
      name: parsed.name,
      quantity: effectiveQuantity !== '1' ? effectiveQuantity : undefined,
      categoryName: effectiveCategory ?? undefined,
      storeName: effectiveStore ?? undefined,
    })
  }

  function reset() {
    setInputValue('')
    setCursorPosition(0)
    setShowSuggestions(false)
    setSelectedIndex(-1)
    setError(null)
    setExplicitQuantity('1')
    setExplicitCategory(null)
    setExplicitStore(null)
    setActivePicker(null)
    setPickerSearch('')
  }

  const state: ComposerState = {
    inputValue,
    cursorPosition,
    showSuggestions,
    selectedIndex,
    activePicker,
    explicitQuantity,
    explicitCategory,
    explicitStore,
    pickerSearch,
    error,
    isPending: mutation.isPending,
  }

  return {
    state,
    parsed,
    effectiveQuantity,
    effectiveCategory,
    effectiveStore,
    suggestions,
    activeProperty,
    categories,
    stores,
    inputRef,
    setInputValue,
    setCursorPosition,
    setShowSuggestions,
    setSelectedIndex,
    togglePicker,
    setExplicitQuantity,
    handleCategorySelect,
    handleStoreSelect,
    setPickerSearch,
    handlePropertyClick,
    handleSuggestionClick,
    handleQuantityChange,
    handleSubmit,
    reset,
    filteredCategories,
    filteredStores,
    categoryExactExists,
    storeExactExists,
  }
}
