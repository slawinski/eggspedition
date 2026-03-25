import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFrequentItemsFn, addGroceryItemFn, getQuickAddItemsFn, getGroceryItemsFn } from '../services/grocery.api'
import { Zap, Plus } from 'lucide-react'
import { Route as rootRoute } from '../routes/__root'
import styles from './QuickAdd.module.css'

const SETTLE_DURATION = 2000 // 2 seconds
const TICK_RATE = 50 // ms

interface SettleState {
  progress: number; // 0 to 1
  lastUpdated: number;
}

export default function QuickAdd() {
  const { session } = rootRoute.useRouteContext()
  const queryClient = useQueryClient()
  const [settling, setSettling] = useState<Record<string, SettleState>>({})
  const rafRef = useRef<number | null>(null)

  const { data: groceryItems = [] } = useQuery({
    queryKey: ['grocery-items', session?.householdId],
    queryFn: () => getGroceryItemsFn(),
    enabled: !!session?.householdId,
  })

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

  // Animation loop for smooth countdown
  useEffect(() => {
    const updateProgress = () => {
      const now = Date.now()
      setSettling(prev => {
        const next = { ...prev }
        let changed = false

        Object.keys(next).forEach(name => {
          const state = next[name]
          const elapsed = now - state.lastUpdated
          const newProgress = Math.max(0, 1 - (elapsed / SETTLE_DURATION))
          
          if (newProgress <= 0) {
            delete next[name]
            changed = true
          } else if (Math.abs(newProgress - state.progress) > 0.01) {
            next[name] = { ...state, progress: newProgress }
            changed = true
          }
        })

        return changed ? next : prev
      })
      rafRef.current = requestAnimationFrame(updateProgress)
    }

    rafRef.current = requestAnimationFrame(updateProgress)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const mutation = useMutation({
    mutationFn: (item: { name: string; categoryId?: string | null; storeId?: string | null }) => {
      // Start/Reset timer
      setSettling(prev => ({ 
        ...prev, 
        [item.name]: { progress: 1, lastUpdated: Date.now() } 
      }))

      return addGroceryItemFn({ 
        data: { 
          name: item.name, 
          quantity: '1',
          categoryId: item.categoryId || undefined,
          storeId: item.storeId || undefined
        } 
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
      queryClient.invalidateQueries({ queryKey: ['household-logs'] })
      queryClient.invalidateQueries({ queryKey: ['frequent-items'] })
    }
  })

  const uncheckedItems = groceryItems.filter(i => i.checked === 'false')
  const uncheckedNames = new Set(uncheckedItems.map(i => i.name))

  const hasTemplates = quickAddItems && quickAddItems.length > 0
  
  const allPossibleItems = hasTemplates 
    ? quickAddItems.map(i => ({ id: i.id, name: i.name, categoryId: i.categoryId, storeId: i.storeId, type: 'template' }))
    : frequentItems.map(i => ({ id: i.name, name: i.name, categoryId: null, storeId: null, type: 'frequent' }))

  const displayItems = allPossibleItems.filter(item => {
    return !uncheckedNames.has(item.name) || settling[item.name]
  })

  if (displayItems.length === 0) return null

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        <Zap className={styles.titleIcon} /> 
        {hasTemplates ? 'Quick Add' : 'Frequently Added'}
      </h3>
      <div className={styles.buttonList}>
        {displayItems.map((item) => {
          const inList = uncheckedItems.find(i => i.name === item.name)
          const settleState = settling[item.name]
          const isSettling = !!settleState
          const quantity = inList ? parseInt(inList.quantity) : 0
          const isCritical = isSettling && settleState.progress < 0.25 // Final 500ms

          return (
            <button
              key={`${item.type}-${item.id}`}
              onClick={(e) => {
                e.stopPropagation()
                mutation.mutate(item)
              }}
              disabled={mutation.isPending}
              className={`${styles.addButton} ${isSettling ? styles.settling : ''} ${isCritical ? styles.critical : ''}`}
            >
              {isSettling && (
                <div 
                  className={styles.timerProgress} 
                  style={{ transform: `scaleX(${settleState.progress})` }} 
                />
              )}
              <Plus className={styles.plusIcon} />
              {item.name}
              {quantity > 1 && <span className={styles.quantityBadge}>{quantity}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
