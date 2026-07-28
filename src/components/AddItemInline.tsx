import { useId, useEffect, useRef } from 'react'
import { useAddItemComposer } from '../hooks/useAddItemComposer'
import AddItemNameCombobox from './AddItemNameCombobox'
import formStyles from './AddItemForm.module.css'

export interface AddItemInlineProps {
  onItemAdded?: (result: { name: string; quantity: string }) => void
}

export default function AddItemInline({
  onItemAdded,
}: AddItemInlineProps) {
  const instanceId = useId()
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    state,
    suggestions,
    activeProperty,
    categories,
    stores,
    setInputValue,
    setCursorPosition,
    setShowSuggestions,
    setSelectedIndex,
    handleSuggestionClick,
    handleSubmit,
  } = useAddItemComposer({ onSuccess: onItemAdded })

  // Click-outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
        // In inline mode, pickers aren't shown, but close them if somehow open
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () =>
      document.removeEventListener('mousedown', handleClickOutside)
  }, [setShowSuggestions])

  // Reset selected index when input changes
  useEffect(() => {
    setSelectedIndex(-1)
  }, [state.inputValue])

  return (
    <div ref={containerRef}>
      <AddItemNameCombobox
        value={state.inputValue}
        onChange={setInputValue}
        onCursorChange={setCursorPosition}
        showSuggestions={state.showSuggestions}
        onShowSuggestionsChange={setShowSuggestions}
        selectedIndex={state.selectedIndex}
        onSelectedIndexChange={setSelectedIndex}
        suggestions={suggestions}
        onSuggestionClick={handleSuggestionClick}
        onSubmit={handleSubmit}
        isPending={state.isPending}
        instanceId={instanceId}
        activeProperty={activeProperty}
        categories={categories}
        stores={stores}
        variant="inline"
      />

      {state.error && (
        <div className={formStyles.errorMessage} role="alert">
          {state.error}
        </div>
      )}
    </div>
  )
}
