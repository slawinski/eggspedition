import { useRef, useEffect, useCallback } from 'react'
import {
  Tag,
  Store as StoreIcon,
  Hash,
  CornerDownLeft,
  Sparkles,
} from 'lucide-react'
import formStyles from './AddItemForm.module.css'
import type { Suggestion } from '../hooks/useAddItemComposer'

export interface AddItemNameComboboxProps {
  value: string
  onChange: (value: string) => void
  onCursorChange: (position: number) => void
  showSuggestions: boolean
  onShowSuggestionsChange: (show: boolean) => void
  selectedIndex: number
  onSelectedIndexChange: (idx: number) => void
  suggestions: Suggestion[]
  onSuggestionClick: (suggestion: Suggestion) => void
  onSubmit: () => void
  isPending: boolean
  instanceId: string
  activeProperty: { type: 'category' | 'store'; query: string } | null
  categories: any[]
  stores: any[]
  variant: 'inline' | 'sheet'
}

export default function AddItemNameCombobox({
  value,
  onChange,
  onCursorChange,
  showSuggestions,
  onShowSuggestionsChange,
  selectedIndex,
  onSelectedIndexChange,
  suggestions,
  onSuggestionClick,
  onSubmit,
  isPending,
  instanceId,
  activeProperty,
  categories,
  stores,
  variant,
}: AddItemNameComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = `${instanceId}-listbox`
  const optionId = (idx: number) => `${instanceId}-option-${idx}`

  // Sync external cursor position changes to the DOM
  const cursorSyncedRef = useRef(false)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    // Only sync when the combobox is focused to avoid stealing focus
    if (document.activeElement === input && !cursorSyncedRef.current) {
      // Cursor position will be read from DOM on next event
      cursorSyncedRef.current = false
    }
  })

  const isSheet = variant === 'sheet'

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value)
      onCursorChange(e.target.selectionStart || 0)
      onShowSuggestionsChange(true)
    },
    [onChange, onCursorChange, onShowSuggestionsChange],
  )

  const handleMouseUp = useCallback(() => {
    onCursorChange(inputRef.current?.selectionStart || 0)
  }, [onCursorChange])

  const handleFocus = useCallback(() => {
    onCursorChange(inputRef.current?.selectionStart || 0)
    onShowSuggestionsChange(true)
  }, [onCursorChange, onShowSuggestionsChange])

  // Sync cursor position from state to DOM after value changes from property click
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    if (document.activeElement === input) {
      requestAnimationFrame(() => {
        if (input) {
          input.selectionStart = input.selectionEnd = value.length
        }
      })
    }
  }, [value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Update cursor position asynchronously
      setTimeout(() => {
        if (inputRef.current)
          onCursorChange(inputRef.current.selectionStart || 0)
      }, 0)

      if (!showSuggestions || suggestions.length === 0) {
        if (e.key === 'Enter' && value.trim()) {
          onSubmit()
        }
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        onSelectedIndexChange(
          selectedIndex < suggestions.length - 1
            ? selectedIndex + 1
            : selectedIndex,
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        onSelectedIndexChange(selectedIndex > 0 ? selectedIndex - 1 : -1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (selectedIndex >= 0) {
          onSuggestionClick(suggestions[selectedIndex])
        } else {
          onSubmit()
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onShowSuggestionsChange(false)
      } else if (e.key === 'Tab') {
        // Tab commits no implicit selection — just close suggestions
        onShowSuggestionsChange(false)
      }
    },
    [
      value,
      showSuggestions,
      suggestions,
      selectedIndex,
      onSubmit,
      onSelectedIndexChange,
      onCursorChange,
      onSuggestionClick,
      onShowSuggestionsChange,
    ],
  )

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      onSubmit()
    },
    [onSubmit],
  )

  const activeOptionId =
    selectedIndex >= 0 && suggestions[selectedIndex]
      ? optionId(selectedIndex)
      : undefined

  return (
    <div
      className={`${formStyles.container} ${isSheet ? formStyles.sheetContainer : ''}`}
    >
      <form onSubmit={handleSubmit} className={formStyles.mainForm}>
        <div className={formStyles.composerRow}>
          <div className={formStyles.inputWrapper}>
            <label htmlFor={`${instanceId}-name`} className="sr-only">
              Item name
            </label>
            <input
              ref={inputRef}
              id={`${instanceId}-name`}
              type="text"
              value={value}
              onChange={handleInputChange}
              onMouseUp={handleMouseUp}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              placeholder="What do you need?"
              className={formStyles.textInput}
              disabled={isPending}
              autoCapitalize="sentences"
              autoCorrect="on"
              autoComplete="off"
              spellCheck
              enterKeyHint="done"
              role="combobox"
              aria-expanded={showSuggestions && suggestions.length > 0}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeOptionId}
            />
          </div>

          {/* Visible Add button */}
          <button
            type="submit"
            className={formStyles.submitButton}
            disabled={!value.trim() || isPending}
            aria-busy={isPending}
            aria-label={isPending ? 'Adding item' : 'Add item'}
          >
            {isPending && (
              <span className={formStyles.spinner} aria-hidden="true" />
            )}
            <span className={formStyles.submitButtonLabel}>Add</span>
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div
            className={formStyles.suggestionsList}
            role="listbox"
            id={listboxId}
            aria-label="Suggestions"
          >
            {suggestions.map((s, idx) => {
              const isHighlighted = idx === selectedIndex

              if (activeProperty) {
                const Icon =
                  activeProperty.type === 'category' ? Tag : StoreIcon
                return (
                  <button
                    key={`${s.name}-${idx}`}
                    type="button"
                    role="option"
                    id={optionId(idx)}
                    aria-selected={isHighlighted}
                    className={`${formStyles.suggestionItem} ${isHighlighted ? formStyles.highlighted : ''}`}
                    onClick={() => onSuggestionClick(s)}
                    onMouseEnter={() => onSelectedIndexChange(idx)}
                  >
                    <div className={formStyles.suggestionMain}>
                      <Icon
                        className={formStyles.iconXs}
                        style={{
                          color:
                            activeProperty.type === 'category'
                              ? 'var(--accent-coral)'
                              : 'var(--accent-lavender)',
                        }}
                      />
                      <span className={formStyles.suggestionName}>
                        {s.name}
                      </span>
                      {s.isNew && (
                        <span className={formStyles.miniTag}>
                          New {activeProperty.type}
                        </span>
                      )}
                    </div>
                    <div className={formStyles.suggestionHint}>
                      {isHighlighted && (
                        <CornerDownLeft
                          className={formStyles.enterIcon}
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
                    ? stores.find((st) => st.id === s.storeId)?.name
                    : null
              const displayQuantityVal =
                s.type === 'New Item' ? s.quantity : null

              return (
                <button
                  key={`${s.name}-${idx}`}
                  type="button"
                  role="option"
                  id={optionId(idx)}
                  aria-selected={isHighlighted}
                  className={`${formStyles.suggestionItem} ${isHighlighted ? formStyles.highlighted : ''}`}
                  onClick={() => onSuggestionClick(s)}
                  onMouseEnter={() => onSelectedIndexChange(idx)}
                >
                  <div className={formStyles.suggestionMain}>
                    {s.isNew && (
                      <Sparkles
                        className={formStyles.iconXs}
                        style={{ color: 'var(--accent-coral)' }}
                      />
                    )}
                    <span className={formStyles.suggestionName}>
                      {s.name}
                    </span>

                    <div className={formStyles.suggestionDetails}>
                      {displayQuantityVal &&
                        displayQuantityVal !== '1' && (
                          <span
                            className={`${formStyles.miniTag} ${formStyles.miniTagQuantity}`}
                          >
                            <Hash
                              className={formStyles.miniTagIcon}
                            />{' '}
                            {displayQuantityVal}
                          </span>
                        )}
                      {displayCategoryVal && (
                        <span
                          className={`${formStyles.miniTag} ${formStyles.miniTagCategory}`}
                        >
                          <Tag className={formStyles.miniTagIcon} />{' '}
                          {displayCategoryVal}
                        </span>
                      )}
                      {displayStoreVal && (
                        <span
                          className={`${formStyles.miniTag} ${formStyles.miniTagStore}`}
                        >
                          <StoreIcon
                            className={formStyles.miniTagIcon}
                          />{' '}
                          {displayStoreVal}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={formStyles.suggestionHint}>
                    <span className={formStyles.suggestionType}>
                      {s.type === 'New Item'
                        ? 'Add new item'
                        : s.type === 'category'
                          ? 'Category'
                          : s.type === 'store'
                            ? 'Store'
                            : s.type}
                    </span>
                    {isHighlighted && (
                      <CornerDownLeft
                        className={formStyles.enterIcon}
                      />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </form>
    </div>
  )
}
