import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getFrequentItemsFn,
  getQuickAddItemsFn,
  getGroceryItemsFn,
} from '../services/grocery.api'
import { useQuickAddAccumulator } from '../hooks/useQuickAddAccumulator'
import { getQuickAddKey } from '../lib/quickAddKey'
import QuickAddTimer from './QuickAddTimer'
import { Zap, Plus } from 'lucide-react'
import { Route as rootRoute } from '../routes/__root'
import styles from './QuickAdd.module.css'

const REPEAT_WINDOW_MS = 1000

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
  const [expanded, setExpanded] = useState(false)
  const isSheet = variant === 'sheet'

  // ── Data queries ──────────────────────────────────────────────────────────────

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

  // ── Accumulator hook (replaces settling / disappearing / pendingNames) ────────

  const accumulator = useQuickAddAccumulator({
    session,
    onMutationSettled: () => {
      // All pending syncs have completed. The displayItems filter below
      // already handles hiding items outside their repeat window — no
      // explicit state removal is needed for correct UX behaviour.
    },
  })

  // ── Item tap handler ──────────────────────────────────────────────────────────

  const handleItemClick = useCallback(
    (item: {
      id?: string
      name: string
      categoryId?: string | null
      storeId?: string | null
    }) => {
      const key = getQuickAddKey({
        templateId: item.id,
        name: item.name,
        categoryId: item.categoryId ?? undefined,
        storeId: item.storeId ?? undefined,
      })

      accumulator.tap({
        key,
        name: item.name,
        categoryId: item.categoryId,
        storeId: item.storeId,
      })
      onItemAdded?.(item.name)
    },
    [accumulator, onItemAdded],
  )

  // ── Display items ─────────────────────────────────────────────────────────────

  const uncheckedItems = groceryItems.filter((i) => i.checked === 'false')
  const uncheckedNames = new Set(uncheckedItems.map((i) => i.name))

  const hasTemplates = quickAddItems && quickAddItems.length > 0

  const allPossibleItems = hasTemplates
    ? quickAddItems.map((i) => ({
        id: i.id,
        name: i.name,
        categoryId: i.categoryId,
        storeId: i.storeId,
        type: 'template' as const,
      }))
    : frequentItems.map((i) => ({
        id: i.name,
        name: i.name,
        categoryId: null as string | null,
        storeId: null as string | null,
        type: 'frequent' as const,
      }))

  // Filter: sheet shows all, standalone hides items already in the unchecked
  // list UNLESS they are still within the repeat window.
  const displayItems = allPossibleItems.filter((item) => {
    const key = getQuickAddKey({
      templateId: item.type === 'template' ? item.id : undefined,
      name: item.name,
      categoryId: item.categoryId ?? undefined,
      storeId: item.storeId ?? undefined,
    })

    if (isSheet) return true

    return (
      !uncheckedNames.has(item.name) ||
      accumulator.isInRepeatWindow(key)
    )
  })

  if (displayItems.length === 0) return null

  const visibleItems =
    isSheet && limit && !expanded
      ? displayItems.slice(0, limit)
      : displayItems

  const hasMore = isSheet && limit && displayItems.length > limit

  // ── Render ────────────────────────────────────────────────────────────────────

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
          const key = getQuickAddKey({
            templateId: item.type === 'template' ? item.id : undefined,
            name: item.name,
            categoryId: item.categoryId ?? undefined,
            storeId: item.storeId ?? undefined,
          })
          const state = accumulator.getState(key)
          const inList = uncheckedItems.find((i) => i.name === item.name)
          const quantity = inList ? parseInt(inList.quantity) : 0

          // When the accumulator has an optimistic quantity, layer it on top
          // of the server quantity so the badge reflects all pending taps.
          const displayedQuantity =
            state.optimisticQuantity > 0
              ? quantity + state.optimisticQuantity
              : quantity

          const isInRepeatWindow = accumulator.isInRepeatWindow(key)
          const progress =
            isInRepeatWindow &&
            state.phase === 'active' &&
            state.repeatWindowEndsAt > 0
              ? Math.max(
                  0,
                  (state.repeatWindowEndsAt - Date.now()) / REPEAT_WINDOW_MS,
                )
              : 0

          const showTimer =
            isInRepeatWindow && !isSheet && state.phase === 'active'
          const isSyncing = state.phase === 'syncing'

          return (
            <button
              key={key}
              onClick={(e) => {
                e.stopPropagation()
                handleItemClick(item)
              }}
              disabled={state.phase === 'failed'}
              className={`
                ${styles.addButton}
                ${showTimer ? styles.settling : ''}
                ${isSheet ? styles.addButtonSheet : ''}
                ${isSyncing ? styles.syncing : ''}
              `}
              aria-label={`Add ${item.name} to the list`}
              aria-busy={isSyncing}
            >
              {/* Visual repeat-window indicator (standalone only) */}
              {showTimer && (
                <QuickAddTimer progress={progress} isActive={true} />
              )}

              {/* Icon: spinner while syncing, plus otherwise */}
              {isSyncing && !isSheet ? (
                <span className={styles.miniSpinner} aria-hidden="true" />
              ) : (
                <Plus className={styles.plusIcon} />
              )}

              {item.name}

              {/* Quantity badge (shown when > 1) */}
              {displayedQuantity > 1 && (
                <span className={styles.quantityBadge}>
                  &times;{displayedQuantity}
                </span>
              )}

              {/* Sheet mode: syncing indicator */}
              {isSheet && isSyncing && (
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
