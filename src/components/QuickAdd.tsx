import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFrequentItemsFn, addGroceryItemFn, getQuickAddItemsFn } from '../services/grocery.api'
import { Zap, Plus } from 'lucide-react'
import { Route as rootRoute } from '../routes/__root'
import utils from '../styles/utils.module.css'

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

  const hasTemplates = quickAddItems && quickAddItems.length > 0
  
  const displayItems = hasTemplates 
    ? quickAddItems.map(i => ({ id: i.id, name: i.name, categoryId: i.categoryId, storeId: i.storeId, type: 'template' }))
    : frequentItems.map(i => ({ id: i.name, name: i.name, categoryId: null, storeId: null, type: 'frequent' }))

  if (displayItems.length === 0) return null

  return (
    <div className={`${utils.flex} ${utils.flexCol} ${utils.gap3}`} style={{ marginBottom: '2rem' }}>
      <h3 className={`${utils.textXs} ${utils.fontBold} ${utils.flex} ${utils.itemsCenter} ${utils.gap1_5} ${utils.uppercase} ${utils.trackingWider} ${utils.opacity60} ${utils.px1}`} style={{ color: 'var(--sea-ink-soft)' }}>
        <Zap className={utils.iconXs} style={{ color: '#ff9a9e' }} /> 
        {hasTemplates ? 'Your Templates' : 'Frequently Added'}
      </h3>
      <div className={`${utils.flex} ${utils.flexWrap} ${utils.gap2}`}>
        {displayItems.map((item) => (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => mutation.mutate(item)}
            disabled={mutation.isPending}
            className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2} ${utils.px4} ${utils.py2_5} ${utils.rounded2xl} ${utils.shadowChip} ${utils.textSm} ${utils.fontBold} ${utils.transition} ${utils.activeScale95} ${utils.hoverTranslateY0_5}`}
            style={{ 
              backgroundColor: 'white', 
              border: '1px solid var(--line)', 
              color: 'var(--sea-ink)',
              cursor: 'pointer'
            }}
          >
            <Plus className={utils.iconSm} style={{ color: '#ff9a9e' }} />
            {item.name}
          </button>
        ))}
      </div>
    </div>
  )
}
