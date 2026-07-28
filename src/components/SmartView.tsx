import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { getGroceryItemsGroupedFn, updateGroceryItemFn, deleteGroceryItemFn, getStoresFn, getCategoriesFn } from '../services/grocery.api'
import clay from '../styles/clay.module.css'
import styles from './SmartView.module.css'
import { Tag, Store as StoreIcon, ShoppingCart } from 'lucide-react'
import type { GroceryItem, Session } from '../lib/schemas'
import { useOptimisticMutation } from '../hooks/useOptimisticMutation'
import { createCompleteCommand, createRestoreCommand, createDeleteCommand } from '../lib/mutation-commands'
import ItemRow from './ItemRow'
import InlineError from './ui/InlineError'
import EmptyState from './ui/EmptyState'
import Skeleton from './ui/Skeleton'
import ShoppingMode from './ShoppingMode'
import StorePicker from './StorePicker'

// ── Constants ─────────────────────────────────────────────────

const STORE_PREF_PREFIX = 'eggspedition:last-store:'

// ── helpers ──────────────────────────────────────────────────

function findItemById(
  id: string,
  groupedData: Record<string, { items: GroceryItem[] }> | undefined,
): GroceryItem | undefined {
  if (!groupedData) return undefined
  for (const group of Object.values(groupedData)) {
    const found = group.items.find((i: GroceryItem) => i.id === id)
    if (found) return found
  }
  return undefined
}

// ── component ────────────────────────────────────────────────

interface SmartViewProps {
  session: Session | null
  mode?: 'shopping' | 'planning'
  storeId?: string
}

export default function SmartView({ session, mode: initialMode, storeId: initialStoreId }: SmartViewProps) {
  const [groupBy, setGroupBy] = useState<'category' | 'store'>('category')

  // ── Shopping mode state machine ───────────────────────────
  const [shoppingMode, setShoppingMode] = useState<'planning' | 'selecting-store' | 'shopping'>('planning')
  const [shoppingStoreId, setShoppingStoreId] = useState<string | 'all'>('all')
  const router = useRouter()

  // Initialize from URL search params on mount
  useEffect(() => {
    if (initialMode === 'shopping') {
      if (initialStoreId) {
        setShoppingStoreId(initialStoreId)
        setShoppingMode('shopping')
      } else {
        // Need to pick a store first
        setShoppingMode('selecting-store')
      }
    }
  }, [initialMode, initialStoreId])

  // Restore last store preference from localStorage
  useEffect(() => {
    if (!session?.householdId) return
    const key = `${STORE_PREF_PREFIX}${session.householdId}`
    try {
      const saved = localStorage.getItem(key)
      if (saved === 'all' || saved) {
        setShoppingStoreId(saved as string | 'all')
      }
    } catch {
      // localStorage unavailable
    }
  }, [session?.householdId])

  const { data: groupedData, isLoading } = useQuery({
    queryKey: ['grocery-items-grouped', groupBy, session?.householdId],
    queryFn: () => getGroceryItemsGroupedFn({ data: groupBy }),
    enabled: !!session?.householdId,
  })

  // Fetch store-grouped data even when showing by category —
  // needed so StorePicker & ShoppingMode can see all items by store.
  const { data: groupedByStore } = useQuery({
    queryKey: ['grocery-items-grouped', 'store', session?.householdId],
    queryFn: () => getGroceryItemsGroupedFn({ data: 'store' }),
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

  // ── Complete / Restore mutation ────────────────────────────

  const completeMutation = useOptimisticMutation({
    mutationFn: (vars: { id: string; checked: 'true' | 'false' }) =>
      updateGroceryItemFn({ data: { id: vars.id, data: { checked: vars.checked } } }),
    invalidationKeys: [
      ['grocery-items', session?.householdId ?? ''],
      ['grocery-items-grouped', session?.householdId ?? ''],
      ['household-logs', session?.householdId ?? ''],
      ['frequent-items', session?.householdId ?? ''],
    ],
    commandFactory: (result, vars) => {
      // result is the updated GroceryItem
      if (vars.checked === 'true') {
        return createCompleteCommand(result as GroceryItem, session?.householdId ?? '')
      } else {
        return createRestoreCommand(result as GroceryItem, session?.householdId ?? '')
      }
    },
  })

  // ── Delete mutation ────────────────────────────────────────

  const deleteMutation = useOptimisticMutation({
    mutationFn: (id: string) => deleteGroceryItemFn({ data: id }),
    invalidationKeys: [
      ['grocery-items', session?.householdId ?? ''],
      ['grocery-items-grouped', session?.householdId ?? ''],
      ['household-logs', session?.householdId ?? ''],
      ['frequent-items', session?.householdId ?? ''],
      ['quick-add-items', session?.householdId ?? ''],
    ],
    commandFactory: (_, id) => {
      const item = findItemById(id as string, groupedData as Record<string, { items: GroceryItem[] }> | undefined)
      if (!item) return null
      return createDeleteCommand(item, session?.householdId ?? '')
    },
  })

  // ── Handlers ───────────────────────────────────────────────

  const handleToggle = (newGroupBy: 'category' | 'store') => {
    if (newGroupBy === groupBy) return
    setGroupBy(newGroupBy)
  }

  const handleComplete = (item: GroceryItem) => {
    if (item.checked === 'false') {
      completeMutation.mutate({ id: item.id, checked: 'true' })
    } else {
      completeMutation.mutate({ id: item.id, checked: 'false' })
    }
  }

  const handleDelete = (item: GroceryItem) => {
    deleteMutation.mutate(item.id)
  }

  const handleEdit = (_item: GroceryItem) => {
    // placeholder for UX-005
  }

  // ── Shopping mode: URL management ─────────────────────────

  type SearchParams = Record<string, string | undefined> & { mode?: 'shopping' | 'planning'; store?: string }

  const updateShoppingUrl = (mode: 'shopping' | null, store?: string | 'all') => {
    router.navigate({
      search: (prev: SearchParams) => {
        const next = { ...prev }
        if (mode === 'shopping') {
          next.mode = 'shopping'
          next.store = store || undefined
        } else {
          delete next.mode
          delete next.store
        }
        return next
      },
      replace: true,
    } as any)
  }

  const handleEnterShopping = () => {
    // Check if there are stores with items
    if (!groupedByStore) return

    const storesWithItems = Object.entries(groupedByStore).filter(
      ([, group]: [string, any]) => group.items.some((item: GroceryItem) => item.checked !== 'true'),
    )

    if (storesWithItems.length > 1) {
      // Show store picker
      setShoppingMode('selecting-store')
    } else if (storesWithItems.length === 1) {
      // Exactly one store has items — go directly to shopping with that store
      const singleStoreId = storesWithItems[0][0]
      if (session?.householdId) {
        try {
          localStorage.setItem(`${STORE_PREF_PREFIX}${session.householdId}`, singleStoreId)
        } catch { /* ignore */ }
      }
      setShoppingStoreId(singleStoreId)
      setShoppingMode('shopping')
      updateShoppingUrl('shopping', singleStoreId)
    } else {
      // No stores have items — shouldn't happen since button is hidden,
      // but go to 'all' mode as fallback
      setShoppingStoreId('all')
      setShoppingMode('shopping')
      updateShoppingUrl('shopping', 'all')
    }
  }

  const handleStoreSelect = (storeId: string | 'all') => {
    setShoppingStoreId(storeId)
    setShoppingMode('shopping')
    updateShoppingUrl('shopping', storeId)
  }

  const handleExitShopping = () => {
    setShoppingMode('planning')
    updateShoppingUrl(null)
  }

  const handleChangeStore = (storeId: string | 'all') => {
    // Persist preference
    if (session?.householdId) {
      try {
        localStorage.setItem(`${STORE_PREF_PREFIX}${session.householdId}`, storeId)
      } catch { /* ignore */ }
    }
    setShoppingStoreId(storeId)
    setShoppingMode('shopping')
    updateShoppingUrl('shopping', storeId)
  }

  const handleOpenStorePicker = () => {
    setShoppingMode('selecting-store')
  }

  // ── Compute active item count for "Start shopping" button ──

  const activeItemCount = (() => {
    if (!groupedByStore) return 0
    let count = 0
    for (const group of Object.values(groupedByStore)) {
      for (const item of (group as any).items as GroceryItem[]) {
        if (item.checked !== 'true') count++
      }
    }
    return count
  })()

  // ── Responsive column count ────────────────────────────────

  const [columnCount, setColumnCount] = useState(3)
  useEffect(() => {
    const updateCount = () => {
      const width = window.innerWidth
      if (width < 768) setColumnCount(1)
      else if (width < 1100) setColumnCount(2)
      else setColumnCount(3)
    }
    updateCount()
    window.addEventListener('resize', updateCount)
    return () => window.removeEventListener('resize', updateCount)
  }, [])

  // ── Loading state ──────────────────────────────────────────

  if (isLoading && !groupedData) {
    return (
      <div className={styles.masonryGrid}>
        {[1, 2, 3].map((col) => (
          <div key={col} className={styles.masonryColumn}>
            <Skeleton variant="card" />
            <Skeleton variant="card" height="90px" />
          </div>
        ))}
      </div>
    )
  }

  if (!groupedData) return null

  // ── Store picker sheet ─────────────────────────────────────

  if (shoppingMode === 'selecting-store') {
    return (
      <StorePicker
        session={session}
        groupedData={groupedByStore as any}
        stores={stores}
        selectedStoreId={shoppingStoreId}
        onSelect={handleStoreSelect}
        onCancel={() => {
          setShoppingMode('planning')
          updateShoppingUrl(null)
        }}
      />
    )
  }

  // ── Shopping mode view ─────────────────────────────────────

  if (shoppingMode === 'shopping' && groupedByStore) {
    return (
      <>
        {/* Mutation errors */}
        {completeMutation.isError && completeMutation.error instanceof Error && (
          <InlineError
            message="Couldn't update item."
            onRetry={() => completeMutation.variables && completeMutation.mutate(completeMutation.variables as any)}
            variant="banner"
          />
        )}
        {deleteMutation.isError && deleteMutation.error instanceof Error && (
          <InlineError
            message="Couldn't delete item."
            variant="banner"
          />
        )}

        <ShoppingMode
          session={session}
          selectedStoreId={shoppingStoreId}
          groupedData={groupedByStore as any}
          stores={stores}
          categories={categories}
          onExit={handleExitShopping}
          onChangeStore={handleChangeStore}
          onPickNewStore={handleOpenStorePicker}
          onComplete={handleComplete}
          onDelete={handleDelete}
        />
      </>
    )
  }

  // ── Planning mode ──────────────────────────────────────────

  // Filter empty groups only (keep checked items for restore)
  const visibleData = Object.entries(groupedData).reduce(
    (acc: Record<string, { items: GroceryItem[]; category?: { name: string }; store?: { name: string } }>, [id, group]: [string, any]) => {
      if (group.items.length > 0) {
        acc[id] = group
      }
      return acc
    },
    {},
  )

  const allEntries = Object.entries(visibleData)

  // Distribute items into stable columns for masonry effect
  const columnData: [string, any][][] = Array.from({ length: columnCount }, () => [])
  allEntries.forEach((entry, index) => {
    columnData[index % columnCount].push(entry)
  })

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className={styles.container}>
      {/* ── Mutation errors ── */}
      {completeMutation.isError && completeMutation.error instanceof Error && (
        <InlineError
          message="Couldn't update item."
          onRetry={() => completeMutation.variables && completeMutation.mutate(completeMutation.variables as any)}
          variant="banner"
        />
      )}
      {deleteMutation.isError && deleteMutation.error instanceof Error && (
        <InlineError
          message="Couldn't delete item."
          variant="banner"
        />
      )}

      {/* ── Start Shopping button ── */}
      {activeItemCount > 0 && (
        <div className={styles.shoppingCta}>
          <button
            type="button"
            className={`${clay.button} ${clay.buttonCoral} ${styles.shoppingCtaButton}`}
            onClick={handleEnterShopping}
          >
            <ShoppingCart className={styles.shoppingCtaIcon} aria-hidden="true" />
            {activeItemCount} item{activeItemCount !== 1 ? 's' : ''} to buy — Start shopping
          </button>
        </div>
      )}

      {/* ── Group-by toggle ── */}
      <div className={styles.toggleWrapper}>
        <div
          className={`
            ${styles.toggleSlider}
            ${groupBy === 'category' ? styles.toggleSliderCategory : styles.toggleSliderStore}
          `}
        />
        <button
          onClick={() => handleToggle('category')}
          className={`${styles.toggleButton} ${groupBy === 'category' ? styles.toggleActive : ''}`}
        >
          By Category
        </button>
        <button
          onClick={() => handleToggle('store')}
          className={`${styles.toggleButton} ${groupBy === 'store' ? styles.toggleActive : ''}`}
        >
          By Store
        </button>
      </div>

      {/* ── Masonry grid ── */}
      <div className={styles.masonryGrid}>
        {allEntries.length === 0 ? (
          <EmptyState
            title="Your list is clear!"
            body="Add some items from the Quick Add bar below to get started."
          />
        ) : (
          columnData.map((columnEntries, colIdx) => (
            <div key={`col-${colIdx}`} className={styles.masonryColumn}>
              {columnEntries.map(([id, group]: [string, any]) => {
                const label =
                  groupBy === 'category'
                    ? group.category?.name || 'Uncategorized'
                    : group.store?.name || 'Any Store'
                const Icon = groupBy === 'category' ? Tag : StoreIcon

                return (
                  <div key={id} className={`${clay.card} ${styles.groupCard}`}>
                    <h3 className={styles.groupHeader}>
                      <div
                        className={`${styles.groupIconWrapper} ${groupBy === 'category' ? styles.groupIconWrapperCategory : styles.groupIconWrapperStore}`}
                      >
                        <Icon className={styles.groupIcon} />
                      </div>
                      <span className={styles.groupHeaderLabel}>{label}</span>
                    </h3>
                    <div className={styles.itemList}>
                      {group.items.map((item: GroceryItem) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          groupBy={groupBy}
                          stores={stores}
                          categories={categories}
                          onComplete={handleComplete}
                          onDelete={handleDelete}
                          onEdit={handleEdit}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
