import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFrequentItemsFn, addGroceryItemFn, getQuickAddItemsFn } from '../services/grocery.api'
import { Zap, Plus } from 'lucide-react'
import { Route as rootRoute } from '../routes/__root'

export default function QuickAdd() {
  const { session } = rootRoute.useRouteContext()
  const queryClient = useQueryClient()

  const { data: frequentItems = [] } = useQuery({
    queryKey: ['frequent-items', session?.householdId],
    queryFn: () => getFrequentItemsFn(),
    enabled: !!session?.householdId,
  })

  const { data: quickAddItems = [] } = useQuery({
    queryKey: ['quick-add-items', session?.householdId],
    queryFn: () => getQuickAddItemsFn(),
    enabled: !!session?.householdId,
  })

  console.log('[QuickAdd] quickAddItems count:', quickAddItems.length)
  console.log('[QuickAdd] frequentItems count:', frequentItems.length)

  const mutation = useMutation({
    mutationFn: (item: { name: string; categoryId?: string | null; storeId?: string | null }) => 
      addGroceryItemFn({ 
        data: { 
          name: item.name, 
          quantity: '1',
          categoryId: item.categoryId || undefined,
          storeId: item.storeId || undefined
        } 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
      queryClient.invalidateQueries({ queryKey: ['household-logs'] })
      queryClient.invalidateQueries({ queryKey: ['frequent-items'] })
    }
  })

  // Combine and deduplicate or prioritize
  // For now, if templates exist, only show templates. 
  // If not, show frequent items.
  const hasTemplates = quickAddItems && quickAddItems.length > 0
  const hasFrequent = frequentItems && frequentItems.length > 0

  console.log('[QuickAdd] State:', { hasTemplates, templateCount: quickAddItems?.length, hasFrequent, frequentCount: frequentItems?.length })

  const displayItems = hasTemplates 
    ? quickAddItems.map(i => ({ id: i.id, name: i.name, categoryId: i.categoryId, storeId: i.storeId, type: 'template' }))
    : frequentItems.map(i => ({ id: i.name, name: i.name, categoryId: null, storeId: null, type: 'frequent' }))

  if (displayItems.length === 0) {
    console.log('[QuickAdd] No items to display')
    return null
  }

  return (
    <div className="flex flex-col gap-3 mb-8">
      <h3 className="text-xs font-bold flex items-center gap-1.5 text-[var(--sea-ink-soft)] uppercase tracking-wider opacity-60 px-1">
        <Zap className="h-3 w-3 text-[#ff9a9e]" /> 
        {hasTemplates ? 'Your Templates' : 'Frequently Added'}
      </h3>
      <div className="flex flex-wrap gap-2">
        {displayItems.map((item) => (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => mutation.mutate(item)}
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-[var(--line)] shadow-clay-sm text-sm font-bold text-[var(--sea-ink)] hover:bg-white hover:shadow-clay-md hover:translate-y-[-2px] active:scale-95 transition-all disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5 text-[#ff9a9e]" />
            {item.name}
          </button>
        ))}
      </div>
    </div>
  )
}
