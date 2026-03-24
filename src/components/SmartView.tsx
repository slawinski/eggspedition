import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { getGroceryItemsGroupedFn, updateGroceryItemFn, deleteGroceryItemFn, getStoresFn } from '../services/grocery.api'
import styles from '../styles/clay.module.css'
import { Tag, Store as StoreIcon, CheckCircle2, Circle, Trash2 } from 'lucide-react'
import type { GroceryItem, Session, Store } from '../lib/schemas'

export default function SmartView({ session }: { session: Session | null }) {
  const queryClient = useQueryClient()
  const [groupBy, setGroupBy] = useState<'category' | 'store'>('category')
  const [filterId, setFilterId] = useState<string>('all')

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

  if (isLoading) return <div className="text-center py-10 opacity-50 font-bold uppercase tracking-widest text-xs">Organizing your list...</div>
  if (!groupedData) return null

  // Process data based on mode and filters
  const filteredData = Object.entries(groupedData).reduce((acc: any, [id, group]: [string, any]) => {
    const items = group.items.filter((item: GroceryItem) => {
      if (filterId === 'all') return true
      if (filterId === 'none') {
        return groupBy === 'category' ? !item.storeId : !item.categoryId
      }
      return groupBy === 'category' ? item.storeId === filterId : item.categoryId === filterId
    })
    
    if (items.length > 0) {
      acc[id] = { ...group, items }
    }
    return acc
  }, {})

  const filterItems = groupBy === 'category' ? stores : categories
  const filterLabel = groupBy === 'category' ? 'Store' : 'Category'

  return (
    <div className="flex flex-col gap-6">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-center p-1 bg-white/40 backdrop-blur-sm rounded-2xl shadow-clay-sm self-center border border-white/20">
        <button
          onClick={() => { setGroupBy('category'); }}
          className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${groupBy === 'category' ? 'bg-[#ff9a9e] text-white shadow-clay-sm' : 'text-[var(--sea-ink-soft)] hover:bg-white/50'}`}
        >
          By Category
        </button>
        <button
          onClick={() => { setGroupBy('store'); }}
          className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${groupBy === 'store' ? 'bg-[#a18cd1] text-white shadow-clay-sm' : 'text-[var(--sea-ink-soft)] hover:bg-white/50'}`}
        >
          By Store
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(filteredData).length === 0 ? (
          <div className="col-span-full text-center py-16 rounded-[3rem] border-2 border-dashed border-[var(--line)] opacity-40 italic font-medium">
            No items match this filter.
          </div>
        ) : (
          Object.entries(filteredData).map(([id, group]: [string, any]) => {
            const label = groupBy === 'category' 
              ? (group.category?.name || 'Uncategorized')
              : (group.store?.name || 'Any Store');
            const Icon = groupBy === 'category' ? Tag : StoreIcon;
            
            return (
              <div key={id} className={`${styles.card} flex flex-col gap-3 !p-5 !rounded-[2.5rem]`}>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--sea-ink)] flex items-center gap-2 mb-1 px-1">
                  <div className={`p-1.5 rounded-lg ${groupBy === 'category' ? 'bg-[#ff9a9e]/10 text-[#ff9a9e]' : 'bg-[#a18cd1]/10 text-[#a18cd1]'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {label}
                </h3>
                <div className="flex flex-col gap-2.5">
                  {group.items.map((item: GroceryItem) => (
                    <div key={item.id} className="flex items-center justify-between text-sm p-3.5 rounded-2xl bg-white border border-[var(--line)] shadow-clay-sm transition-all hover:translate-y-[-1px]">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                          onClick={() => updateMutation.mutate({ id: item.id, checked: item.checked === 'true' ? 'false' : 'true' })}
                          className="flex-shrink-0 focus:outline-none transition-transform active:scale-90 cursor-pointer"
                        >
                          {item.checked === 'true' ? (
                            <CheckCircle2 className="h-6 w-6 text-[#84fab0]" />
                          ) : (
                            <Circle className="h-6 w-6 text-[var(--sea-ink-soft)] opacity-30" />
                          )}
                        </button>
                        <div className="flex flex-col min-w-0">
                          <span className={`font-bold text-[var(--sea-ink)] truncate ${item.checked === 'true' ? 'line-through opacity-40' : ''}`}>
                            {item.name}
                          </span>
                          {/* Show the OTHER badge (e.g. show Store badge when grouped by Category) */}
                          {filterId === 'all' && (
                            <div className="flex gap-2 mt-0.5">
                              {groupBy === 'category' && item.storeId && (
                                <span className="text-[9px] flex items-center gap-1 text-[#ff9a9e] font-bold uppercase tracking-wider opacity-70">
                                  <StoreIcon className="h-2.5 w-2.5" />
                                  {stores?.find((s: any) => s.id === item.storeId)?.name}
                                </span>
                              )}
                              {groupBy === 'store' && item.categoryId && (
                                <span className="text-[9px] flex items-center gap-1 text-[#a18cd1] font-bold uppercase tracking-wider opacity-70">
                                  <Tag className="h-2.5 w-2.5" />
                                  {categories?.find((c: any) => c.id === item.categoryId)?.name}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.quantity !== '1' && (
                          <span className="text-[10px] bg-[var(--page-bg)] border border-[var(--line)] px-2 py-0.5 rounded-lg text-[var(--sea-ink-soft)] font-bold">
                            x{item.quantity}
                          </span>
                        )}
                        <button
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
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
