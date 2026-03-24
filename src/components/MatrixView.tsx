import { useState, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { getGroceryItemsGroupedFn, householdSignalFn, updateGroceryItemFn, deleteGroceryItemFn } from '../services/grocery.api'
import styles from '../styles/clay.module.css'
import utils from '../styles/utils.module.css'
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

  if (isLoading) return <div className={`${utils.textCenter} ${utils.py4} ${utils.opacity60}`}>Grouping items...</div>

  if (!groupedData) return null

  return (
    <div className={`${utils.flex} ${utils.flexCol} ${utils.gap6}`}>
      <div className={`${utils.flex} ${utils.justifyCenter}`}>
        <div className={`${styles.card} ${utils.flex} ${utils.p1} ${utils.gap1} ${utils.rounded2xl}`}>
          <button
            onClick={() => setGroupBy('category')}
            className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2} ${utils.px4} ${utils.py2} ${utils.roundedXl} ${utils.transition}`}
            style={{ 
              backgroundColor: groupBy === 'category' ? '#ff9a9e' : 'transparent',
              color: groupBy === 'category' ? 'white' : 'var(--sea-ink-soft)',
              boxShadow: groupBy === 'category' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Tag className={utils.icon} /> Category
          </button>
          <button
            onClick={() => setGroupBy('store')}
            className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2} ${utils.px4} ${utils.py2} ${utils.roundedXl} ${utils.transition}`}
            style={{ 
              backgroundColor: groupBy === 'store' ? '#a18cd1' : 'transparent',
              color: groupBy === 'store' ? 'white' : 'var(--sea-ink-soft)',
              boxShadow: groupBy === 'store' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Store className={utils.icon} /> Store
          </button>
        </div>
      </div>

      <div className={`${utils.grid} ${utils.gridCols1} ${utils.smGridCols3} ${utils.gap6}`} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {Object.entries(groupedData).map(([key, group]: [string, any]) => (
          <div key={key} className={`${styles.card} ${utils.flex} ${utils.flexCol} ${utils.gap3}`}>
            <h3 className={`${utils.textSm} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider} ${utils.flex} ${utils.itemsCenter} ${utils.gap2}`} style={{ color: 'var(--sea-ink-soft)' }}>
              <LayoutGrid className={utils.icon} />
              {groupBy === 'category' ? group.category?.name || 'Uncategorized' : group.store?.name || 'Any Store'}
            </h3>
            <div className={`${utils.flex} ${utils.flexCol} ${utils.gap2}`}>
              {group.items.map((item: GroceryItem) => (
                <div key={item.id} className={`${utils.flex} ${utils.itemsCenter} ${utils.justifyBetween} ${utils.textSm} ${utils.p3} ${utils.roundedXl} ${utils.shadowChip}`} style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                  <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap3} ${utils.flex1}`}>
                    <button
                      onClick={() => updateMutation.mutate({ id: item.id, checked: item.checked === 'true' ? 'false' : 'true' })}
                      className={`${utils.outlineNone} ${utils.transitionTransform} ${utils.activeScale90} ${utils.cursorPointer}`}
                      style={{ background: 'none', border: 'none', padding: 0 }}
                    >
                      {item.checked === 'true' ? (
                        <CheckCircle2 className={`${utils.h5} ${utils.w5}`} style={{ color: '#84fab0' }} />
                      ) : (
                        <Circle className={`${utils.h5} ${utils.w5} ${utils.opacity40}`} style={{ color: 'var(--sea-ink-soft)' }} />
                      )}
                    </button>
                    <span className={`${utils.fontMedium} ${item.checked === 'true' ? `${utils.lineThrough} ${utils.opacity40}` : ''}`} style={{ color: 'var(--sea-ink)' }}>
                      {item.name}
                    </span>
                  </div>
                  <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2}`}>
                    {item.quantity !== '1' && <span className={`${utils.text10px} ${utils.px2} ${utils.py1} ${utils.rounded}`} style={{ backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--sea-ink-soft)' }}>{item.quantity}</span>}
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
              {group.items.length === 0 && <p className={`${utils.textXs} ${utils.opacity40} ${utils.px2}`} style={{ fontStyle: 'italic' }}>No items</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
