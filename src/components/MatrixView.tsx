import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getGroceryItemsGroupedFn, householdSignalFn } from '../services/grocery.api'
import styles from '../styles/clay.module.css'
import { Tag, Store, LayoutGrid } from 'lucide-react'
import { GroceryItem, Category, Store as StoreType } from '../lib/schemas'

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

export default function MatrixView() {
  useHouseholdSignals()
  const [groupBy, setGroupBy] = useState<'category' | 'store'>('category')

  const { data: groupedData, isLoading } = useQuery({
    queryKey: ['grocery-items-grouped', groupBy],
    queryFn: () => getGroceryItemsGroupedFn({ data: groupBy }),
  })

  if (isLoading) return <div className="text-center py-4 opacity-50">Grouping items...</div>

  if (!groupedData) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-center">
        <div className={`${styles.card} flex p-1 gap-1 !rounded-2xl`}>
          <button
            onClick={() => setGroupBy('category')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              groupBy === 'category' ? 'bg-[#ff9a9e] text-white shadow-md' : 'text-[var(--sea-ink-soft)]'
            }`}
          >
            <Tag className="h-4 w-4" /> Category
          </button>
          <button
            onClick={() => setGroupBy('store')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              groupBy === 'store' ? 'bg-[#a18cd1] text-white shadow-md' : 'text-[var(--sea-ink-soft)]'
            }`}
          >
            <Store className="h-4 w-4" /> Store
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(groupedData).map(([key, group]: [string, any]) => (
          <div key={key} className={`${styles.card} flex flex-col gap-3`}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--sea-ink-soft)] flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              {groupBy === 'category' ? group.category?.name || 'Uncategorized' : group.store?.name || 'Any Store'}
            </h3>
            <div className="flex flex-col gap-2">
              {group.items.map((item: GroceryItem) => (
                <div key={item.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-[rgba(255,255,255,0.5)]">
                  <span className={item.checked === 'true' ? 'line-through opacity-40' : ''}>
                    {item.name}
                  </span>
                  {item.quantity !== '1' && <span className="text-xs opacity-50">{item.quantity}</span>}
                </div>
              ))}
              {group.items.length === 0 && <p className="text-xs opacity-30 italic">No items</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
