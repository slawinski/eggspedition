import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFrequentItemsFn, addGroceryItemFn, getQuickAddItemsFn } from '../services/grocery.api'
import { Zap, Plus } from 'lucide-react'
import { Route as rootRoute } from '../routes/__root'
import styles from './QuickAdd.module.css'

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
    <div className={styles.container}>
      <h3 className={styles.title}>
        <Zap className={styles.titleIcon} /> 
        {hasTemplates ? 'Your Templates' : 'Frequently Added'}
      </h3>
      <div className={styles.buttonList}>
        {displayItems.map((item) => (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => mutation.mutate(item)}
            disabled={mutation.isPending}
            className={styles.addButton}
          >
            <Plus className={styles.plusIcon} />
            {item.name}
          </button>
        ))}
      </div>
    </div>
  )
}
