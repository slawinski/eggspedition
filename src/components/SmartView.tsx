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
  const [finishing, setFinishing] = useState<Record<string, boolean>>({})
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})

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

  const handleToggle = (newGroupBy: 'category' | 'store') => {
    if (newGroupBy === groupBy) return
    setGroupBy(newGroupBy)
  }

  // Responsive column count logic
  const [columnCount, setColumnCount] = useState(3)
  useEffect(() => {
    const updateCount = () => {
      const width = window.innerWidth
      if (width < 768) setColumnCount(1)
      else if (width < 1100) setColumnCount(2)
      else setColumnCount(3)
    }
    updateCount()
    window.addEventListener('resize', updateCount)
    return () => window.removeEventListener('resize', updateCount)
  }, [])

  if (isLoading && !groupedData) return <div className={styles.loading}>Organizing your list...</div>
  if (!groupedData) return null

  const filteredData = Object.entries(groupedData).reduce((acc: any, [id, group]: [string, any]) => {
    const visibleItems = group.items.filter((item: GroceryItem) => (item.checked === 'false' || finishing[item.id]) && !deleting[item.id])
    
    if (visibleItems.length > 0) {
      acc[id] = { ...group, items: visibleItems }
    }
    return acc
  }, {})

  // Distribute items into stable columns for masonry effect
  const columnData: any[][] = Array.from({ length: columnCount }, () => [])
  Object.entries(filteredData).forEach((entry, index) => {
    columnData[index % columnCount].push(entry)
  })

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

      <div className={styles.masonryGrid}>
        {Object.entries(filteredData).length === 0 ? (
          <div className={styles.emptyState}>
            Your list is clear!
          </div>
        ) : (
          columnData.map((columnEntries, colIdx) => (
            <div key={`col-${colIdx}`} className={styles.masonryColumn}>
              {columnEntries.map(([id, group]: [string, any]) => {
                const label = groupBy === 'category' 
                  ? (group.category?.name || 'Uncategorized')
                  : (group.store?.name || 'Any Store');
                const Icon = groupBy === 'category' ? Tag : StoreIcon;
                
                return (
                  <div 
                    key={id} 
                    className={`${clay.card} ${styles.groupCard}`}
                  >
                    <h3 className={styles.groupHeader}>
                      <div className={`${styles.groupIconWrapper} ${groupBy === 'category' ? styles.groupIconWrapperCategory : styles.groupIconWrapperStore}`}>
                        <Icon className={styles.groupIcon} />
                      </div>
                      <span className={styles.groupHeaderLabel}>{label}</span>
                    </h3>                    <div className={styles.itemList}>
                      {group.items.map((item: GroceryItem) => (
                        <div 
                          key={item.id} 
                          className={styles.itemRow}
                        >
                          <div className={styles.itemMain}>
                            <button
                              onClick={() => {
                                setFinishing(prev => ({ ...prev, [item.id]: true }))
                                setTimeout(() => {
                                  updateMutation.mutate({ id: item.id, checked: 'true' })
                                  setFinishing(prev => {
                                    const next = { ...prev }
                                    delete next[item.id]
                                    return next
                                  })
                                }, 300)
                              }}
                              className={styles.checkButton}
                            >
                              {finishing[item.id] ? (
                                <CheckCircle2 className={styles.checkIcon} />
                              ) : (
                                <Circle className={styles.uncheckIcon} />
                              )}
                            </button>
                            <div className={styles.itemInfo}>
                              <span className={styles.itemName}>
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
                              aria-label="Delete item"
                            >
                              <Trash2 className={styles.deleteIcon} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
