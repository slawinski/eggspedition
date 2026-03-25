import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { getGroceryItemsGroupedFn, updateGroceryItemFn, deleteGroceryItemFn, getStoresFn, getCategoriesFn } from '../services/grocery.api'
import clay from '../styles/clay.module.css'
import styles from './SmartView.module.css'
import { Tag, Store as StoreIcon, CheckCircle2, Circle, Trash2 } from 'lucide-react'
import type { GroceryItem, Session } from '../lib/schemas'

export default function SmartView({ session }: { session: Session | null }) {
  const queryClient = useQueryClient()
  const [groupBy, setGroupBy] = useState<'category' | 'store'>('category')
  const [filterId] = useState<string>('all')

  const { data: groupedData, isLoading } = useQuery({
    queryKey: ['grocery-items-grouped', groupBy, session?.householdId],
    queryFn: () => getGroceryItemsGroupedFn({ data: groupBy }),
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

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; checked: 'true' | 'false' }) =>
      updateGroceryItemFn({ data: { id: vars.id, data: { checked: vars.checked } } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGroceryItemFn({ data: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
    }
  })

  if (isLoading) return <div className={styles.loading}>Organizing your list...</div>
  if (!groupedData) return null

  const filteredData = Object.entries(groupedData).reduce((acc: any, [id, group]: [string, any]) => {
    const items = group.items.filter((_item: GroceryItem) => {
      if (filterId === 'all') return true
      return true // simplified for now
    })
    
    if (items.length > 0) {
      acc[id] = { ...group, items }
    }
    return acc
  }, {})

  return (
    <div className={styles.container}>
      <div className={styles.toggleWrapper}>
        <button
          onClick={() => setGroupBy('category')}
          className={`${styles.toggleButton} ${groupBy === 'category' ? styles.toggleButtonCategoryActive : ''}`}
        >
          By Category
        </button>
        <button
          onClick={() => setGroupBy('store')}
          className={`${styles.toggleButton} ${groupBy === 'store' ? styles.toggleButtonStoreActive : ''}`}
        >
          By Store
        </button>
      </div>

      <div className={styles.grid}>
        {Object.entries(filteredData).length === 0 ? (
          <div className={styles.emptyState}>
            No items match this filter.
          </div>
        ) : (
          Object.entries(filteredData).map(([id, group]: [string, any]) => {
            const label = groupBy === 'category' 
              ? (group.category?.name || 'Uncategorized')
              : (group.store?.name || 'Any Store');
            const Icon = groupBy === 'category' ? Tag : StoreIcon;
            
            return (
              <div key={id} className={`${clay.card} ${styles.groupCard}`}>
                <h3 className={styles.groupHeader}>
                  <div className={`${styles.groupIconWrapper} ${groupBy === 'category' ? styles.groupIconWrapperCategory : styles.groupIconWrapperStore}`}>
                    <Icon className={styles.groupIcon} />
                  </div>
                  {label}
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
                        <div className={styles.itemInfo}>
                          <span className={`${styles.itemName} ${item.checked === 'true' ? styles.itemNameChecked : ''}`}>
                            {item.name}
                          </span>
                          <div className={styles.itemSubInfo}>
                            {groupBy === 'category' && item.storeId && (
                              <span className={`${styles.subInfoTag} ${styles.subInfoTagStore}`}>
                                <StoreIcon className={styles.subInfoIcon} />
                                {stores?.find((s: any) => s.id === item.storeId)?.name}
                              </span>
                            )}
                            {groupBy === 'store' && item.categoryId && (
                              <span className={`${styles.subInfoTag} ${styles.subInfoTagCategory}`}>
                                <Tag className={styles.subInfoIcon} />
                                {categories?.find((c: any) => c.id === item.categoryId)?.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={styles.itemActions}>
                        {item.quantity !== '1' && (
                          <span className={styles.quantityBadge}>
                            x{item.quantity}
                          </span>
                        )}
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
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  )
}
