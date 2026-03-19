import { useState, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { getGroceryItemsGroupedFn, householdSignalFn, updateGroceryItemFn, deleteGroceryItemFn } from '../services/grocery.api'
import styles from '../styles/clay.module.css'
import { Tag, Store, LayoutGrid, CheckCircle2, Circle, Trash2 } from 'lucide-react'
import type { GroceryItem } from '../lib/schemas'
import { Route } from '../routes/index'

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
          console.log(`[SSE Matrix] Received chunk:`, chunk)
          if (chunk.includes('data:')) {
            console.log(`[SSE Matrix] Invalidating queries...`)
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
  const { session } = Route.useRouteContext()
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
                <div key={item.id} className="flex items-center justify-between text-sm p-3 rounded-xl bg-[rgba(255,255,255,0.5)] border border-white/20 shadow-sm">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => updateMutation.mutate({ id: item.id, checked: item.checked === 'true' ? 'false' : 'true' })}
                      className="focus:outline-none transition-transform active:scale-90 cursor-pointer"
                    >
                      {item.checked === 'true' ? (
                        <CheckCircle2 className="h-5 w-5 text-[#84fab0]" />
                      ) : (
                        <Circle className="h-5 w-5 text-[var(--sea-ink-soft)] opacity-40" />
                      )}
                    </button>
                    <span className={`font-medium ${item.checked === 'true' ? 'line-through opacity-40' : ''}`}>
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.quantity !== '1' && <span className="text-[10px] bg-black/5 px-1.5 py-0.5 rounded text-[var(--sea-ink-soft)]">{item.quantity}</span>}
                    <button
                      onClick={() => deleteMutation.mutate(item.id)}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {group.items.length === 0 && <p className="text-xs opacity-30 italic px-2">No items</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
