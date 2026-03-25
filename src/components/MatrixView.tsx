import { useState, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { getGroceryItemsGroupedFn, householdSignalFn, updateGroceryItemFn, deleteGroceryItemFn } from '../services/grocery.api'
import clay from '../styles/clay.module.css'
import styles from './MatrixView.module.css'
import { Tag, Store, LayoutGrid, CheckCircle2, Circle, Trash2 } from 'lucide-react'
import type { GroceryItem, Session } from '../lib/schemas'

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
        if (!ctrl.signal.aborted) setTimeout(connect, 3000)
      }
    }
    connect()
    return () => ctrl.abort()
  }, [queryClient])
}

export default function MatrixView({ session }: { session: Session | null }) {
  const queryClient = useQueryClient()
  useHouseholdSignals()
  const [groupBy, setGroupBy] = useState<'category' | 'store'>('category')

  const { data: groupedData, isLoading } = useQuery({
    queryKey: ['grocery-items-grouped', groupBy, session?.householdId],
    queryFn: () => getGroceryItemsGroupedFn({ data: groupBy }),
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; checked: 'true' | 'false' }) =>
      updateGroceryItemFn({ data: { id: vars.id, data: { checked: vars.checked } } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items', session?.householdId] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped', groupBy, session?.householdId] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGroceryItemFn({ data: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items', session?.householdId] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped', groupBy, session?.householdId] })
    }
  })

  if (isLoading) return <div className={styles.loading}>Grouping items...</div>

  if (!groupedData) return null

  return (
    <div className={styles.container}>
      <div className={styles.toggleContainer}>
        <div className={`${clay.card} ${styles.toggleWrapper}`}>
          <button
            onClick={() => setGroupBy('category')}
            className={`${styles.toggleButton} ${groupBy === 'category' ? styles.toggleButtonCategoryActive : ''}`}
          >
            <Tag className={styles.toggleIcon} /> Category
          </button>
          <button
            onClick={() => setGroupBy('store')}
            className={`${styles.toggleButton} ${groupBy === 'store' ? styles.toggleButtonStoreActive : ''}`}
          >
            <Store className={styles.toggleIcon} /> Store
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {Object.entries(groupedData).map(([key, group]: [string, any]) => (
          <div key={key} className={`${clay.card} ${styles.groupCard}`}>
            <h3 className={styles.groupHeader}>
              <LayoutGrid className={styles.groupHeaderIcon} />
              {groupBy === 'category' ? group.category?.name || 'Uncategorized' : group.store?.name || 'Any Store'}
            </h3>
            <div className={styles.itemList}>
              {group.items.map((item: GroceryItem) => (
                <div key={item.id} className={styles.itemRow}>
                  <div className={styles.itemMain}>
                    <button
                      onClick={() => updateMutation.mutate({ id: item.id, checked: item.checked === 'true' ? 'false' : 'true' })}
                      className={styles.checkButton}
                    >
                      {item.checked === 'true' ? (
                        <CheckCircle2 className={styles.checkIcon} />
                      ) : (
                        <Circle className={styles.uncheckIcon} />
                      )}
                    </button>
                    <span className={`${styles.itemName} ${item.checked === 'true' ? styles.itemNameChecked : ''}`}>
                      {item.name}
                    </span>
                  </div>
                  <div className={styles.itemActions}>
                    {item.quantity !== '1' && <span className={styles.quantityBadge}>{item.quantity}</span>}
                    <button
                      onClick={() => deleteMutation.mutate(item.id)}
                      className={styles.deleteButton}
                      title="Delete item"
                    >
                      <Trash2 className={styles.deleteIcon} />
                    </button>
                  </div>
                </div>
              ))}
              {group.items.length === 0 && <p className={styles.emptyGroup}>No items</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
