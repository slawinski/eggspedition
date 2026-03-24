import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { getGroceryItemsGroupedFn, updateGroceryItemFn, deleteGroceryItemFn, getStoresFn, getCategoriesFn } from '../services/grocery.api'
import styles from '../styles/clay.module.css'
import utils from '../styles/utils.module.css'
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

  if (isLoading) return <div className={`${utils.textCenter} ${utils.py10} ${utils.opacity60} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWidest} ${utils.textXs}`}>Organizing your list...</div>
  if (!groupedData) return null

  const filteredData = Object.entries(groupedData).reduce((acc: any, [id, group]: [string, any]) => {
    const items = group.items.filter((item: GroceryItem) => {
      if (filterId === 'all') return true
      return true // simplified for now
    })
    
    if (items.length > 0) {
      acc[id] = { ...group, items }
    }
    return acc
  }, {})

  return (
    <div className={`${utils.flex} ${utils.flexCol} ${utils.gap6}`}>
      <div className={`${utils.flex} ${utils.itemsCenter} ${utils.justifyCenter} ${utils.p1} ${utils.rounded2xl} ${utils.shadowChip} ${utils.borderChip}`} style={{ backgroundColor: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(4px)', alignSelf: 'center' }}>
        <button
          onClick={() => setGroupBy('category')}
          className={`${utils.px6} ${utils.py2} ${utils.roundedXl} ${utils.textXs} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider} ${utils.transition}`}
          style={{ 
            backgroundColor: groupBy === 'category' ? '#ff9a9e' : 'transparent',
            color: groupBy === 'category' ? 'white' : 'var(--sea-ink-soft)',
            boxShadow: groupBy === 'category' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          By Category
        </button>
        <button
          onClick={() => setGroupBy('store')}
          className={`${utils.px6} ${utils.py2} ${utils.roundedXl} ${utils.textXs} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider} ${utils.transition}`}
          style={{ 
            backgroundColor: groupBy === 'store' ? '#a18cd1' : 'transparent',
            color: groupBy === 'store' ? 'white' : 'var(--sea-ink-soft)',
            boxShadow: groupBy === 'store' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          By Store
        </button>
      </div>

      <div className={`${utils.grid} ${utils.gridCols1} ${utils.smGridCols3} ${utils.gap6}`} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {Object.entries(filteredData).length === 0 ? (
          <div className={`${utils.textCenter} ${utils.py12} ${utils.opacity40} ${utils.fontMedium}`} style={{ gridColumn: '1 / -1', borderRadius: '3rem', border: '2px dashed var(--line)', fontStyle: 'italic' }}>
            No items match this filter.
          </div>
        ) : (
          Object.entries(filteredData).map(([id, group]: [string, any]) => {
            const label = groupBy === 'category' 
              ? (group.category?.name || 'Uncategorized')
              : (group.store?.name || 'Any Store');
            const Icon = groupBy === 'category' ? Tag : StoreIcon;
            
            return (
              <div key={id} className={`${styles.card} ${utils.flex} ${utils.flexCol} ${utils.gap3} ${utils.p4} ${utils.rounded2xl}`} style={{ borderRadius: '2.5rem', padding: '1.25rem' }}>
                <h3 className={`${utils.textSm} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider} ${utils.flex} ${utils.itemsCenter} ${utils.gap2} ${utils.mb1} ${utils.px1}`} style={{ color: 'var(--sea-ink)' }}>
                  <div className={`${utils.p1_5} ${utils.rounded}`} style={{ backgroundColor: groupBy === 'category' ? 'rgba(255, 154, 158, 0.1)' : 'rgba(161, 140, 209, 0.1)', color: groupBy === 'category' ? '#ff9a9e' : '#a18cd1' }}>
                    <Icon className={utils.icon} />
                  </div>
                  {label}
                </h3>
                <div className={`${utils.flex} ${utils.flexCol} ${utils.gap2}`}>
                  {group.items.map((item: GroceryItem) => (
                    <div key={item.id} className={`${utils.flex} ${utils.itemsCenter} ${utils.justifyBetween} ${utils.textSm} ${utils.p3} ${utils.rounded2xl} ${utils.shadowChip} ${utils.transition} ${utils.hoverTranslateY0_5}`} style={{ backgroundColor: 'white', border: '1px solid var(--line)' }}>
                      <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap3} ${utils.flex1} ${utils.truncate}`}>
                        <button
                          onClick={() => updateMutation.mutate({ id: item.id, checked: item.checked === 'true' ? 'false' : 'true' })}
                          className={`${utils.outlineNone} ${utils.transitionTransform} ${utils.activeScale90} ${utils.cursorPointer}`}
                          style={{ background: 'none', border: 'none', padding: 0 }}
                        >
                          {item.checked === 'true' ? (
                            <CheckCircle2 className={`${utils.h6} ${utils.w6}`} style={{ color: '#84fab0' }} />
                          ) : (
                            <Circle className={`${utils.h6} ${utils.w6} ${utils.opacity40}`} style={{ color: 'var(--sea-ink-soft)' }} />
                          )}
                        </button>
                        <div className={`${utils.flex} ${utils.flexCol} ${utils.truncate}`}>
                          <span className={`${utils.fontBold} ${utils.truncate} ${item.checked === 'true' ? `${utils.lineThrough} ${utils.opacity40}` : ''}`} style={{ color: 'var(--sea-ink)' }}>
                            {item.name}
                          </span>
                          <div className={`${utils.flex} ${utils.gap2} ${utils.mt0_5}`}>
                            {groupBy === 'category' && item.storeId && (
                              <span className={`${utils.text10px} ${utils.flex} ${utils.itemsCenter} ${utils.gap1} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider} ${utils.opacity60}`} style={{ color: '#ff9a9e' }}>
                                <StoreIcon className={utils.iconXs} />
                                {stores?.find((s: any) => s.id === item.storeId)?.name}
                              </span>
                            )}
                            {groupBy === 'store' && item.categoryId && (
                              <span className={`${utils.text10px} ${utils.flex} ${utils.itemsCenter} ${utils.gap1} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider} ${utils.opacity60}`} style={{ color: '#a18cd1' }}>
                                <Tag className={utils.iconXs} />
                                {categories?.find((c: any) => c.id === item.categoryId)?.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2}`}>
                        {item.quantity !== '1' && (
                          <span className={`${utils.text10px} ${utils.px2} ${utils.py1} ${utils.rounded} ${utils.fontBold}`} style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--line)', color: 'var(--sea-ink-soft)' }}>
                            x{item.quantity}
                          </span>
                        )}
                        <button
                          onClick={() => deleteMutation.mutate(item.id)}
                          className={`${utils.p1_5} ${utils.rounded} ${utils.textRed400} ${utils.transitionColors} ${utils.cursorPointer}`}
                          style={{ background: 'none', border: 'none' }}
                        >
                          <Trash2 className={utils.icon} />
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
