import { useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { getGroceryItemsGroupedFn, updateGroceryItemFn, deleteGroceryItemFn, getStoresFn, getCategoriesFn } from '../services/grocery.api'
import clay from '../styles/clay.module.css'
import styles from './SmartView.module.css'
import { Tag, Store as StoreIcon, CheckCircle2, Circle, Trash2 } from 'lucide-react'
import type { GroceryItem, Session } from '../lib/schemas'

export default function SmartView({ session }: { session: Session | null }) {
  const queryClient = useQueryClient()
  const [groupBy, setGroupBy] = useState<'category' | 'store'>('category')
  const [disappearing, setDisappearing] = useState<Record<string, boolean>>({})
  const [displayData, setDisplayData] = useState<any>(null)

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

  // Sync displayData with query data using View Transitions for smooth grid morphing
  useEffect(() => {
    if (!groupedData) return

    const update = () => {
      setDisplayData(groupedData)
      
      // Clean up disappearing state
      setDisappearing(prev => {
        const next = { ...prev }
        let changed = false
        const allItems = Object.values(groupedData).flatMap((g: any) => g.items)
        Object.keys(next).forEach(id => {
          const item = allItems.find((i: any) => i.id === id)
          if (!item || item.checked === 'true') {
            delete next[id]
            changed = true
          }
        })
        return changed ? next : prev
      })
    }

    if ((document as any).startViewTransition && displayData) {
      (document as any).startViewTransition(() => {
        flushSync(update)
      })
    } else {
      update()
    }
  }, [groupedData])

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; checked: 'true' | 'false' }) =>
      updateGroceryItemFn({ data: { id: vars.id, data: { checked: vars.checked } } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
      queryClient.invalidateQueries({ queryKey: ['household-logs'] })
      queryClient.invalidateQueries({ queryKey: ['frequent-items'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGroceryItemFn({ data: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
      queryClient.invalidateQueries({ queryKey: ['household-logs'] })
      queryClient.invalidateQueries({ queryKey: ['frequent-items'] })
    }
  })

  const handleAction = (id: string, action: () => void) => {
    const update = () => {
      setDisappearing(prev => ({ ...prev, [id]: true }))
    }

    if ((document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        flushSync(update)
      })
    } else {
      update()
    }

    // Wait for the visual transition to complete before triggering the data change
    setTimeout(() => {
      action()
    }, 400)
  }

  const handleToggle = (newGroupBy: 'category' | 'store') => {
    if (newGroupBy === groupBy) return
    if ((document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        flushSync(() => {
          setGroupBy(newGroupBy)
        })
      })
    } else {
      setGroupBy(newGroupBy)
    }
  }

  if (isLoading && !displayData) return <div className={styles.loading}>Organizing your list...</div>
  if (!displayData) return null

  const filteredData = Object.entries(displayData).reduce((acc: any, [id, group]: [string, any]) => {
    const visibleItems = group.items.filter((item: GroceryItem) => {
      // Keep item visible if it's not checked OR if it's currently in its "poof" animation
      if (item.checked === 'true' && !disappearing[item.id]) return false
      return true
    })
    
    // Check if the whole group is in the process of vanishing
    const isGroupDisappearing = visibleItems.length > 0 && visibleItems.every((item: GroceryItem) => disappearing[item.id])

    if (visibleItems.length > 0) {
      acc[id] = { ...group, items: visibleItems, isDisappearing: isGroupDisappearing }
    }
    return acc
  }, {})

  return (
    <div className={styles.container}>
      <div className={styles.toggleWrapper}>
        <div className={`
          ${styles.toggleSlider} 
          ${groupBy === 'category' ? styles.toggleSliderCategory : styles.toggleSliderStore}
        `} />
        <button
          onClick={() => handleToggle('category')}
          className={`${styles.toggleButton} ${groupBy === 'category' ? styles.toggleActive : ''}`}
        >
          By Category
        </button>
        <button
          onClick={() => handleToggle('store')}
          className={`${styles.toggleButton} ${groupBy === 'store' ? styles.toggleActive : ''}`}
        >
          By Store
        </button>
      </div>

      <div className={styles.grid}>
        {Object.entries(filteredData).length === 0 ? (
          <div className={styles.emptyState}>
            Your list is clear!
          </div>
        ) : (
          Object.entries(filteredData).map(([id, group]: [string, any]) => {
            const label = groupBy === 'category' 
              ? (group.category?.name || 'Uncategorized')
              : (group.store?.name || 'Any Store');
            const Icon = groupBy === 'category' ? Tag : StoreIcon;
            
            return (
              <div 
                key={id} 
                className={`
                  ${clay.card} 
                  ${styles.groupCard} 
                  ${group.isDisappearing ? styles.groupDisappearing : ''}
                `}
                style={{ viewTransitionName: `group-${id.replace(/[^a-zA-Z0-9]/g, '_')}` } as any}
              >
                <h3 className={styles.groupHeader}>
                  <div className={`${styles.groupIconWrapper} ${groupBy === 'category' ? styles.groupIconWrapperCategory : styles.groupIconWrapperStore}`}>
                    <Icon className={styles.groupIcon} />
                  </div>
                  {label}
                </h3>
                <div className={styles.itemList}>
                  {group.items.map((item: GroceryItem) => (
                    <div 
                      key={item.id} 
                      className={`${styles.itemRow} ${disappearing[item.id] ? styles.disappearing : ''}`}
                      style={{ viewTransitionName: `item-${item.id.replace(/[^a-zA-Z0-9]/g, '_')}` } as any}
                    >
                      <div className={styles.itemMain}>
                        <button
                          onClick={() => {
                            const newChecked = item.checked === 'true' ? 'false' : 'true';
                            if (newChecked === 'true') {
                              handleAction(item.id, () => updateMutation.mutate({ id: item.id, checked: 'true' }));
                            } else {
                              updateMutation.mutate({ id: item.id, checked: 'false' });
                            }
                          }}
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
                          onClick={() => handleAction(item.id, () => deleteMutation.mutate(item.id))}
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
