import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGroceryItemsFn, updateGroceryItemFn, deleteGroceryItemFn, householdSignalFn, getCategoriesFn, getStoresFn } from '../services/grocery.api'
import type { GroceryItem } from '../lib/schemas'
import clay from '../styles/clay.module.css'
import styles from './GroceryList.module.css'
import { CheckCircle2, Circle, Trash2, Tag, Store as StoreIcon } from 'lucide-react'
import { useRef, useEffect } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import type { Session } from '../lib/schemas'

function useHouseholdSignals() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const ctrl = new AbortController()
    
    const connect = async () => {
      try {
        const response = await householdSignalFn({ signal: ctrl.signal })
        const reader = response.body?.getReader()
        if (!reader) return

        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value)
          if (chunk.includes('data:')) {
            queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
            queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
            queryClient.invalidateQueries({ queryKey: ['household-logs'] })
          }
        }
      } catch (err) {
        if (!ctrl.signal.aborted) {
          setTimeout(connect, 3000)
        }
      }
    }

    connect()
    return () => ctrl.abort()
  }, [queryClient])
}

export default function GroceryList({ session }: { session: Session | null }) {
  const queryClient = useQueryClient()
  useHouseholdSignals()
  const parentRef = useRef<HTMLDivElement>(null)

  const { data: items, isLoading: isLoadingItems, error: itemsError } = useQuery({
    queryKey: ['grocery-items', session?.householdId],
    queryFn: () => getGroceryItemsFn(),
    enabled: !!session?.householdId,
  })

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

  const rowVirtualizer = useWindowVirtualizer({
    count: items?.length || 0,
    estimateSize: () => 110,
    overscan: 10,
    scrollMargin: parentRef.current?.offsetTop || 0,
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; checked: 'true' | 'false' }) =>
      updateGroceryItemFn({ data: { id: vars.id, data: { checked: vars.checked } } }),
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['grocery-items', session?.householdId] })
      const previousItems = queryClient.getQueryData(['grocery-items', session?.householdId])
      queryClient.setQueryData(['grocery-items', session?.householdId], (old: GroceryItem[]) =>
        old.map((item) => (item.id === newItem.id ? { ...item, checked: newItem.checked } : item))
      )
      return { previousItems }
    },
    onError: (_err, _newItem, context) => {
      queryClient.setQueryData(['grocery-items', session?.householdId], context?.previousItems)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items', session?.householdId] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGroceryItemFn({ data: id }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['grocery-items', session?.householdId] })
      const previousItems = queryClient.getQueryData(['grocery-items', session?.householdId])
      queryClient.setQueryData(['grocery-items', session?.householdId], (old: GroceryItem[]) =>
        old.filter((item) => item.id !== id)
      )
      return { previousItems }
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(['grocery-items', session?.householdId], context?.previousItems)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items', session?.householdId] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
    },
  })

  if (isLoadingItems) return <div className={styles.loading}>Loading list...</div>
  if (itemsError) return <div className={styles.error}>Error loading list.</div>

  if (!items || items.length === 0) {
    return (
      <div className={`${clay.card} ${styles.empty}`}>
        <p>Your list is empty. Add something yummy!</p>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className={styles.listContainer}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index]
          if (!item) return null
          
          const category = categories.find(c => c.id === item.categoryId)
          const store = stores.find(s => s.id === item.storeId)
          
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                paddingBottom: '12px',
              }}
            >
              <div 
                className={`${clay.card} ${styles.itemCard}`}
              >
                <div className={styles.itemContent}>
                  <button
                    onClick={() => updateMutation.mutate({ id: item.id, checked: item.checked === 'true' ? 'false' : 'true' })}
                    className={styles.checkButton}
                    aria-label={item.checked === 'true' ? 'Uncheck item' : 'Check item'}
                  >
                    {item.checked === 'true' ? (
                      <CheckCircle2 className={styles.checkIcon} />
                    ) : (
                      <Circle className={styles.uncheckIcon} />
                    )}
                  </button>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemNameWrapper}>
                      <span className={`${styles.itemName} ${item.checked === 'true' ? styles.itemNameChecked : ''}`}>
                        {item.name}
                      </span>
                      {item.quantity !== '1' && (
                        <span className={styles.quantityBadge}>
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    <div className={styles.tagList}>
                      {category && (
                        <span className={`${styles.tagBase} ${styles.categoryTag}`}>
                          <Tag className={styles.tagIcon} /> {category.name}
                        </span>
                      )}
                      {store && (
                        <span className={`${styles.tagBase} ${styles.storeTag}`}>
                          <StoreIcon className={styles.tagIcon} /> {store.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(item.id)}
                  className={styles.deleteButton}
                  aria-label="Delete item"
                >
                  <Trash2 className={styles.deleteIcon} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
