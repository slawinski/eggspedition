import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { getGroceryItemsGroupedFn, updateGroceryItemFn, deleteGroceryItemFn, getStoresFn } from '../services/grocery.api'
import styles from '../styles/clay.module.css'
import { Tag, Store as StoreIcon, CheckCircle2, Circle, Trash2 } from 'lucide-react'
import type { GroceryItem, Session, Store } from '../lib/schemas'

export default function SmartView({ session }: { session: Session | null }) {
  const queryClient = useQueryClient()
  const [selectedStore, setSelectedStore] = useState<string>('all')

  const { data: groupedData, isLoading } = useQuery({
    queryKey: ['grocery-items-grouped', 'category', session?.householdId],
    queryFn: () => getGroceryItemsGroupedFn({ data: 'category' }),
  })

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: () => getStoresFn(),
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; checked: 'true' | 'false' }) =>
      updateGroceryItemFn({ data: { id: vars.id, data: { checked: vars.checked } } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items', session?.householdId] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped', 'category', session?.householdId] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGroceryItemFn({ data: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items', session?.householdId] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped', 'category', session?.householdId] })
    }
  })

  if (isLoading) return <div className="text-center py-4 opacity-50">Grouping items...</div>
  if (!groupedData) return null

  // Process data based on store filter
  // groupedData is { [categoryName]: { category, items: [...] } }
  // We need to filter items within categories
  const filteredData = Object.entries(groupedData).reduce((acc: any, [key, group]: [string, any]) => {
    const filteredItems = group.items.filter((item: GroceryItem) => {
      if (selectedStore === 'all') return true
      if (selectedStore === 'none') return !item.storeId
      return item.storeId === selectedStore
    })
    
    if (filteredItems.length > 0) {
      acc[key] = { ...group, items: filteredItems }
    }
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-6">
      {/* Store Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => setSelectedStore('all')}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
            selectedStore === 'all' 
              ? 'bg-[#a18cd1] text-white shadow-md' 
              : 'bg-white/50 text-[var(--sea-ink-soft)] hover:bg-white'
          }`}
        >
          All Stores
        </button>
        {stores?.map((store: Store) => (
          <button
            key={store.id}
            onClick={() => setSelectedStore(store.id)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              selectedStore === store.id 
                ? 'bg-[#a18cd1] text-white shadow-md' 
                : 'bg-white/50 text-[var(--sea-ink-soft)] hover:bg-white'
            }`}
          >
            {store.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(filteredData).length === 0 ? (
          <div className="col-span-full text-center py-10 opacity-40 italic">
            No items found for this store.
          </div>
        ) : (
          Object.entries(filteredData).map(([key, group]: [string, any]) => (
            <div key={key} className={`${styles.card} flex flex-col gap-3 !p-4`}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--sea-ink-soft)] flex items-center gap-2">
                <Tag className="h-4 w-4 opacity-60" />
                {group.category?.name || 'Uncategorized'}
              </h3>
              <div className="flex flex-col gap-2">
                {group.items.map((item: GroceryItem) => (
                  <div key={item.id} className="flex items-center justify-between text-sm p-3 rounded-xl bg-[rgba(255,255,255,0.6)] border border-white/40 shadow-sm transition-all hover:scale-[1.01]">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => updateMutation.mutate({ id: item.id, checked: item.checked === 'true' ? 'false' : 'true' })}
                        className="flex-shrink-0 focus:outline-none transition-transform active:scale-90 cursor-pointer"
                      >
                        {item.checked === 'true' ? (
                          <CheckCircle2 className="h-5 w-5 text-[#84fab0]" />
                        ) : (
                          <Circle className="h-5 w-5 text-[var(--sea-ink-soft)] opacity-40" />
                        )}
                      </button>
                      <div className="flex flex-col min-w-0">
                        <span className={`font-medium truncate ${item.checked === 'true' ? 'line-through opacity-40' : ''}`}>
                          {item.name}
                        </span>
                        {/* Show Store badge if viewing All Stores and item has a store */}
                        {selectedStore === 'all' && item.storeId && (
                          <span className="text-[10px] flex items-center gap-1 text-[var(--sea-ink-soft)] opacity-60 font-semibold">
                            <StoreIcon className="h-2.5 w-2.5" />
                            {stores?.find((s: Store) => s.id === item.storeId)?.name || 'Store'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.quantity !== '1' && (
                        <span className="text-[10px] bg-black/5 px-1.5 py-0.5 rounded text-[var(--sea-ink-soft)] font-bold">
                          {item.quantity}
                        </span>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 transition-colors cursor-pointer opacity-40 hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
