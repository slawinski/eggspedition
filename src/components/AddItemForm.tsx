import { useRouteContext } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { addGroceryItemFn, getCategoriesFn, getStoresFn, getQuickAddItemsFn } from '../services/grocery.api'
import styles from './AddItemForm.module.css'
import { Tag, Store as StoreIcon, Hash, CornerDownLeft, Sparkles } from 'lucide-react'
import { z } from 'zod'
import Modal from './Modal'
import ManageTags from './ManageTags'

const addItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  quantity: z.string().optional(),
  categoryName: z.string().optional().nullable(),
  storeName: z.string().optional().nullable(),
})

type Suggestion = {
  name: string
  type: 'category' | 'store' | 'Quick Add' | 'New Item'
  isNew?: boolean
  categoryId?: string | null
  storeId?: string | null
  categoryName?: string | null
  storeName?: string | null
  quantity?: string | null
  id?: string
}

export default function AddItemForm({ onSuccess }: { onSuccess?: () => void }) {
  const { session } = useRouteContext({ from: '__root__' })
  const [inputValue, setInputValue] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [managingType, setManagingType] = useState<'category' | 'store' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const queryClient = useQueryClient()

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

  const { data: quickAddItems = [] } = useQuery({
    queryKey: ['quick-add-items', session?.householdId],
    queryFn: () => getQuickAddItemsFn(),
    enabled: !!session?.householdId,
  })

  // DSL Parser
  const parseDSL = (input: string) => {
    const categoryMatch = input.match(/#([^\s#@]+)/)
    const storeMatch = input.match(/@([^\s#@]+)/)
    const quantityMatch = input.match(/\s[x\*](\d+)/) || input.match(/^(\d+)\s/)
    
    const categoryName = categoryMatch ? categoryMatch[1] : null
    const storeName = storeMatch ? storeMatch[1] : null
    const quantity = quantityMatch ? quantityMatch[1] : '1'
    
    let name = input
      .replace(/#[^\s#@]+/, '')
      .replace(/@[^\s#@]+/, '')
      .replace(/\s[x\*](\d+)/, '')
      .replace(/^(\d+)\s/, '')
      .trim()
      
    return { name, categoryName, storeName, quantity }
  }

  const parsed = parseDSL(inputValue)

  // Determine what type of suggestions to show
  const getActiveProperty = () => {
    // If there is a space right before the cursor, we are not in a tag
    if (cursorPosition > 0 && inputValue[cursorPosition - 1] === ' ') {
      return null;
    }

    const textBeforeCursor = inputValue.substring(0, cursorPosition);
    const words = textBeforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1];

    if (currentWord.startsWith('#')) {
      return { type: 'category' as const, query: currentWord.substring(1) };
    }
    if (currentWord.startsWith('@')) {
      return { type: 'store' as const, query: currentWord.substring(1) };
    }
    return null;
  };

  const activeProperty = getActiveProperty();

  const getSuggestions = (): Suggestion[] => {
    if (activeProperty) {
      const { type, query } = activeProperty;
      const list = type === 'category' ? categories : stores;
      const matches: Suggestion[] = list
        .filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
        .map(i => ({ name: i.name, type: type }));
      
      const hasExactMatch = matches.some(m => m.name.toLowerCase() === query.toLowerCase());
      if (query && !hasExactMatch) {
        matches.push({ name: query, type: type, isNew: true });
      }
      return matches.slice(0, 5);
    }

    if (parsed.name.length > 0) {
      const quickMatches: Suggestion[] = quickAddItems
        .filter(i => i.name.toLowerCase().includes(parsed.name.toLowerCase()))
        .map(i => ({ ...i, type: 'Quick Add' as const }));

      const hasExactMatch = quickMatches.some(
        m => m.name.toLowerCase() === parsed.name.toLowerCase()
      );

      const suggestions: Suggestion[] = [...quickMatches];

      if (!hasExactMatch) {
        suggestions.push({ 
          name: parsed.name, 
          type: 'New Item' as const, 
          isNew: true, 
          categoryName: parsed.categoryName, 
          storeName: parsed.storeName, 
          quantity: parsed.quantity 
        });
      }

      return suggestions.slice(0, 6);
    }

    return [];
  };

  const suggestions = getSuggestions();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setSelectedIndex(-1)
  }, [inputValue])

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof addItemSchema>) => 
      addGroceryItemFn({ data }),
    onSuccess: () => {
      setInputValue('')
      setCursorPosition(0)
      setShowSuggestions(false)
      setSelectedIndex(-1)
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
      queryClient.invalidateQueries({ queryKey: ['household-logs'] })
      queryClient.invalidateQueries({ queryKey: ['frequent-items'] })
      onSuccess?.()
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to add item')
    }
  })

  const handlePropertyClick = (propName: string) => {
    if (!activeProperty) return;
    const symbol = activeProperty.type === 'category' ? '#' : '@';
    const textBeforeCursor = inputValue.substring(0, cursorPosition);
    const textAfterCursor = inputValue.substring(cursorPosition);
    
    // Replace the current partial tag with the selected one
    const replacement = `${symbol}${propName} `;
    const newTextBefore = textBeforeCursor.replace(new RegExp(`${symbol}[^\\s#@]*$`), replacement);
    const newText = newTextBefore + textAfterCursor;
    const newPos = newTextBefore.length;

    setInputValue(newText);
    setCursorPosition(newPos);
    setShowSuggestions(true);
    setSelectedIndex(-1);
    
    // Set DOM selection manually to be safe
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.selectionStart = newPos;
        inputRef.current.selectionEnd = newPos;
        inputRef.current.focus();
      }
    }, 0);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (activeProperty) {
      handlePropertyClick(suggestion.name);
      return;
    }

    if (suggestion.type === 'New Item') {
      handleSubmit()
      return
    }

    const { categoryName, storeName, quantity } = parsed
    mutation.mutate({
      name: suggestion.name,
      quantity: quantity || undefined,
      categoryName: categoryName || (suggestion.categoryId ? categories.find(c => c.id === suggestion.categoryId)?.name : null),
      storeName: storeName || (suggestion.storeId ? stores.find(s => s.id === suggestion.storeId)?.name : null),
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Update cursor position state on every key stroke
    setTimeout(() => {
      if (inputRef.current) setCursorPosition(inputRef.current.selectionStart || 0);
    }, 0);

    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && inputValue.trim()) {
        handleSubmit(e)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0) {
        handleSuggestionClick(suggestions[selectedIndex])
      } else {
        handleSubmit()
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleSubmit = (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault()
    if (!parsed.name) return
    setError(null)

    mutation.mutate({
      name: parsed.name,
      quantity: parsed.quantity,
      categoryName: parsed.categoryName,
      storeName: parsed.storeName,
    })
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <form onSubmit={handleSubmit} className={styles.mainForm}>
        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setCursorPosition(e.target.selectionStart || 0)
              setShowSuggestions(true)
            }}
            onMouseUp={() => setCursorPosition(inputRef.current?.selectionStart || 0)}
            onFocus={() => {
              setCursorPosition(inputRef.current?.selectionStart || 0)
              setShowSuggestions(true)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Add milk #Dairy @Costco..."
            className={styles.textInput}
            disabled={mutation.isPending}
          />

          {showSuggestions && suggestions.length > 0 && (
            <div className={styles.suggestionsList}>
              {suggestions.map((s, idx) => {
                const isHighlighted = idx === selectedIndex;
                
                if (activeProperty) {
                  const Icon = activeProperty.type === 'category' ? Tag : StoreIcon;
                  return (
                    <button
                      key={`${s.name}-${idx}`}
                      type="button"
                      className={`${styles.suggestionItem} ${isHighlighted ? styles.highlighted : ''}`}
                      onClick={() => handleSuggestionClick(s)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <div className={styles.suggestionMain}>
                        <Icon className={styles.iconXs} style={{ color: activeProperty.type === 'category' ? '#ff9a9e' : '#a18cd1' }} />
                        <span className={styles.suggestionName}>{s.name}</span>
                        {s.isNew && <span className={styles.miniTag}>New {activeProperty.type}</span>}
                      </div>
                      <div className={styles.suggestionHint}>
                        {isHighlighted && <CornerDownLeft className={styles.enterIcon} />}
                      </div>
                    </button>
                  );
                }

                const displayCategory = s.type === 'New Item' 
                  ? s.categoryName 
                  : (s.categoryId ? categories.find(c => c.id === s.categoryId)?.name : null);
                const displayStore = s.type === 'New Item' 
                  ? s.storeName 
                  : (s.storeId ? stores.find(st => st.id === s.storeId)?.name : null);
                const displayQuantity = s.type === 'New Item' ? s.quantity : null;

                return (
                  <button
                    key={`${s.name}-${idx}`}
                    type="button"
                    className={`${styles.suggestionItem} ${isHighlighted ? styles.highlighted : ''}`}
                    onClick={() => handleSuggestionClick(s)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className={styles.suggestionMain}>
                      {s.isNew && <Sparkles className={styles.iconXs} style={{ color: '#ff9a9e' }} />}
                      <span className={styles.suggestionName}>{s.name}</span>
                      
                      <div className={styles.suggestionDetails}>
                        {displayQuantity && displayQuantity !== '1' && (
                          <span className={`${styles.miniTag} ${styles.miniTagQuantity}`}>
                            <Hash className={styles.miniTagIcon} /> {displayQuantity}
                          </span>
                        )}
                        {displayCategory && (
                          <span className={`${styles.miniTag} ${styles.miniTagCategory}`}>
                            <Tag className={styles.miniTagIcon} /> {displayCategory}
                          </span>
                        )}
                        {displayStore && (
                          <span className={`${styles.miniTag} ${styles.miniTagStore}`}>
                            <StoreIcon className={styles.miniTagIcon} /> {displayStore}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={styles.suggestionHint}>
                      <span className={styles.suggestionType}>{s.type}</span>
                      {isHighlighted && <CornerDownLeft className={styles.enterIcon} />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </form>
      
      {error && <p className={styles.errorMessage}>{error}</p>}

      <Modal 
        isOpen={!!managingType} 
        onClose={() => setManagingType(null)} 
        title={`Manage ${managingType === 'category' ? 'Categories' : 'Stores'}`}
      >
        {managingType && (
          <ManageTags 
            type={managingType} 
            tags={managingType === 'category' ? (categories || []) : (stores || [])} 
            onClose={() => setManagingType(null)}
          />
        )}
      </Modal>
    </div>
  )
}
