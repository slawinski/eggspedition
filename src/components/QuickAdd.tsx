import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getFrequentItemsFn,
  getQuickAddItemsFn,
  getGroceryItemsFn,
} from '../services/grocery.api'
import { useAddGroceryItem } from '../hooks/useAddGroceryItem'
import { Zap, Plus, Check } from 'lucide-react'
import { Route as rootRoute } from '../routes/__root'
import styles from './QuickAdd.module.css'

const SETTLE_DURATION = 1000 // 1 second
const DISAPPEAR_DURATION = 400 // ms for exit animation

interface SettleState {
  progress: number // 0 to 1
  lastUpdated: number
  isDone?: boolean
}

export interface QuickAddProps {
  variant?: 'standalone' | 'sheet'
  limit?: number
  onItemAdded?: (name: string) => void
}

export default function QuickAdd({
  variant = 'standalone',
  limit,
  onItemAdded,
}: QuickAddProps) {
  const { session } = rootRoute.useRouteContext()
  const [settling, setSettling] = useState<Record<string, SettleState>>({})
  const [disappearing, setDisappearing] = useState<Record<string, boolean>>({})
  const [pendingNames, setPendingNames] = useState<Set<string>>(
    () => new Set(),
  )
  const [expanded, setExpanded] = useState(false)
  const rafRef = useRef<number | null>(null)
  const timeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const isSheet = variant === 'sheet'

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

  // Animation loop for smooth countdown (standalone mode only)
  useEffect(() => {
    if (isSheet) return

    const updateProgress = () => {
      const now = Date.now()
      setSettling((prev) => {
        const next = { ...prev }
        let changed = false

        Object.keys(next).forEach((name) => {
          const state = next[name]
          if (state.isDone) return

          const elapsed = now - state.lastUpdated
          const newProgress = Math.max(
            0,
            1 - elapsed / SETTLE_DURATION,
          )

          if (newProgress <= 0) {
            next[name] = { ...state, progress: 0, isDone: true }
            setDisappearing((d) => ({ ...d, [name]: true }))

            const tid = setTimeout(() => {
              setSettling((current) => {
                const updated = { ...current }
                delete updated[name]
                return updated
              })
              setDisappearing((current) => {
                const updated = { ...current }
                delete updated[name]
                return updated
              })
            }, DISAPPEAR_DURATION)
            timeoutIdsRef.current.add(tid)

            changed = true
          } else if (
            Math.abs(newProgress - state.progress) > 0.005
          ) {
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
      timeoutIdsRef.current.forEach(clearTimeout)
      timeoutIdsRef.current.clear()
    }
  }, [isSheet])

  const mutation = useAddGroceryItem({
    onSuccess: (_result, variables) => {
      setPendingNames((prev) => {
        const next = new Set(prev)
        next.delete(variables.name)
        return next
      })

      onItemAdded?.(variables.name)

      if (isSheet) {
        // Brief success flash — remove pending after a short delay
        setTimeout(() => {
          setSettling((prev) => {
            const next = { ...prev }
            delete next[variables.name]
            return next
          })
        }, 600)
      }
    },
    onError: (_error: Error, variables) => {
      // Clear only the failed item's pending state
      if (variables?.name) {
        setPendingNames((prev) => {
          const next = new Set(prev)
          next.delete(variables.name)
          return next
        })
        if (!isSheet) {
          setSettling((prev) => {
            const next = { ...prev }
            delete next[variables.name]
            return next
          })
        }
      }
    },
  })

  const handleItemClick = useCallback(
    (item: {
      id?: string
      name: string
      categoryId?: string | null
      storeId?: string | null
    }) => {
      // Prevent duplicate clicks for same item
      if (pendingNames.has(item.name)) return

      setPendingNames((prev) => new Set(prev).add(item.name))

      if (isSheet) {
        // In sheet mode: simple disabled state, brief success
        setSettling((prev) => ({
          ...prev,
          [item.name]: { progress: 1, lastUpdated: Date.now(), isDone: false },
        }))
      } else {
        // Standalone: start settle timer
        setSettling((prev) => ({
          ...prev,
          [item.name]: {
            progress: 1,
            lastUpdated: Date.now(),
            isDone: false,
          },
        }))
        setDisappearing((prev) => {
          const next = { ...prev }
          delete next[item.name]
          return next
        })
      }

      mutation.mutate({
        name: item.name,
        quantity: '1',
        categoryId: item.categoryId || undefined,
        storeId: item.storeId || undefined,
      })
    },
    [pendingNames, isSheet, mutation],
  )

  const uncheckedItems = groceryItems.filter(
    (i) => i.checked === 'false',
  )
  const uncheckedNames = new Set(uncheckedItems.map((i) => i.name))

  const hasTemplates = quickAddItems && quickAddItems.length > 0

  const allPossibleItems = hasTemplates
    ? quickAddItems.map((i) => ({
        id: i.id,
        name: i.name,
        categoryId: i.categoryId,
        storeId: i.storeId,
        type: 'template',
      }))
    : frequentItems.map((i) => ({
        id: i.name,
        name: i.name,
        categoryId: null as string | null,
        storeId: null as string | null,
        type: 'frequent',
      }))

  // In standalone mode: hide items already in the unchecked list (unless settling/disappearing)
  // In sheet mode: show all items, show quantity badges
  const displayItems = allPossibleItems.filter((item) => {
    if (isSheet) return true
    return (
      !uncheckedNames.has(item.name) ||
      settling[item.name] ||
      disappearing[item.name]
    )
  })

  if (displayItems.length === 0) return null

  // Apply limit in sheet mode
  const visibleItems =
    isSheet && limit && !expanded
      ? displayItems.slice(0, limit)
      : displayItems

  const hasMore = isSheet && limit && displayItems.length > limit

  return (
    <div
      className={`${styles.container} ${isSheet ? styles.containerSheet : ''}`}
    >
      {!isSheet && (
        <h3 className={styles.title}>
          <Zap className={styles.titleIcon} />
          {hasTemplates ? 'Quick Add' : 'Frequently Added'}
        </h3>
      )}
      {isSheet && (
        <h3 className={styles.title}>
          <Zap className={styles.titleIcon} />
          Quick Add
        </h3>
      )}

      <div
        className={`${styles.buttonList} ${isSheet ? styles.buttonListSheet : ''}`}
      >
        {visibleItems.map((item) => {
          const inList = uncheckedItems.find(
            (i) => i.name === item.name,
          )
          const settleState = settling[item.name]
          const isSettling = !!settleState
          const isDone = settleState?.isDone
          const isDisappearing = disappearing[item.name]
          const quantity = inList ? parseInt(inList.quantity) : 0
          const isPending = pendingNames.has(item.name)

          return (
            <button
              key={`${item.type}-${item.id}`}
              onClick={(e) => {
                e.stopPropagation()
                handleItemClick(item)
              }}
              disabled={isPending || (isDone && !isSheet)}
              className={`
                ${styles.addButton}
                ${isSettling ? styles.settling : ''}
                ${isDone && !isSheet ? styles.settled : ''}
                ${isDisappearing ? styles.disappearing : ''}
                ${isSheet ? styles.addButtonSheet : ''}
                ${isSheet && isDone ? styles.addButtonSheetDone : ''}
              `}
            >
              {isSettling && !isDone && !isSheet && (
                <div
                  className={styles.timerProgress}
                  style={{
                    transform: `scaleX(${settleState.progress})`,
                  }}
                />
              )}
              {isDone ? (
                <Check
                  className={
                    isSheet
                      ? styles.checkIconSheet
                      : styles.checkIcon
                  }
                />
              ) : (
                <Plus className={styles.plusIcon} />
              )}
              {item.name}
              {quantity > 1 && !isDone && (
                <span className={styles.quantityBadge}>
                  {quantity}
                </span>
              )}
              {isSheet && isPending && (
                <span className={styles.pendingSpinner} />
              )}
            </button>
          )
        })}
      </div>

      {hasMore && (
        <button
          type="button"
          className={styles.showAllButton}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : 'Show all'}
        </button>
      )}
    </div>
  )
}
