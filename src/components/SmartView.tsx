import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getGroceryItemsGroupedFn, updateGroceryItemFn, deleteGroceryItemFn, getStoresFn, getCategoriesFn } from '../services/grocery.api'
import clay from '../styles/clay.module.css'
import styles from './SmartView.module.css'
import { Tag, Store as StoreIcon } from 'lucide-react'
import type { GroceryItem, Session } from '../lib/schemas'
import { useOptimisticMutation } from '../hooks/useOptimisticMutation'
import { createCompleteCommand, createRestoreCommand, createDeleteCommand } from '../lib/mutation-commands'
import ItemRow from './ItemRow'
import InlineError from './ui/InlineError'
import EmptyState from './ui/EmptyState'
import Skeleton from './ui/Skeleton'
import ItemEditor from './ItemEditor'

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

export default function SmartView({ session }: { session: Session | null }) {
  const [groupBy, setGroupBy] = useState<'category' | 'store'>('category')

  const queryClient = useQueryClient()

  // ── Item editor state ─────────────────────────────────────
  const [editingItem, setEditingItem] = useState<GroceryItem | null>(null)

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

  // ── Active items for merge detection ──────────────────────
  const activeItems = useMemo<GroceryItem[]>(() => {
    if (!groupedData) return []
    const items: GroceryItem[] = []
    for (const group of Object.values(groupedData)) {
      for (const item of (group as any).items ?? []) {
        if (item.checked === 'false') items.push(item)
      }
    }
    return items
  }, [groupedData])

  // ── Complete / Restore mutation ────────────────────────────

  const completeMutation = useOptimisticMutation({
    mutationFn: (vars: { id: string; checked: 'true' | 'false' }) =>
      updateGroceryItemFn({ data: { id: vars.id, data: { checked: vars.checked } } }),
    optimisticUpdate: (vars) => {
      const hhId = session?.householdId ?? ''
      return [
        {
          queryKey: ['grocery-items', hhId] as string[],
          previousData: undefined,
          patch: (_prev: unknown) => {
            // Transform the cache optimistically: update the item's checked state
            if (!_prev || !Array.isArray(_prev)) return _prev
            return (_prev as any[]).map((i: any) =>
              i.id === vars.id ? { ...i, checked: vars.checked } : i,
            )
          },
        },
        {
          queryKey: ['grocery-items-grouped', hhId] as string[],
          previousData: undefined,
          patch: (_prev: unknown) => {
            if (!_prev || typeof _prev !== 'object' || _prev === null) return _prev
            const result = { ...(_prev as Record<string, any>) }
            for (const key of Object.keys(result)) {
              if (result[key]?.items) {
                result[key] = {
                  ...result[key],
                  items: result[key].items.map((i: any) =>
                    i.id === vars.id ? { ...i, checked: vars.checked } : i,
                  ),
                }
              }
            }
            return result
          },
        },
      ]
    },
    invalidationKeys: [
      ['grocery-items', session?.householdId ?? ''],
      ['grocery-items-grouped', session?.householdId ?? ''],
      ['household-logs', session?.householdId ?? ''],
      ['frequent-items', session?.householdId ?? ''],
    ],
    commandFactory: (_, vars) => {
      const item = findItemById(
        vars.id,
        groupedData as Record<string, { items: GroceryItem[] }> | undefined,
      )
      if (!item) return null
      if (vars.checked === 'true') {
        return createCompleteCommand(item, session?.householdId ?? '')
      } else {
        return createRestoreCommand(item, session?.householdId ?? '')
      }
    },
    undoRollback: async (vars) => {
      await updateGroceryItemFn({
        data: { id: vars.id, data: { checked: vars.checked === 'true' ? 'false' : 'true' } },
      })
    },
  })

  // ── Delete mutation ────────────────────────────────────────

  const deleteMutation = useOptimisticMutation({
    mutationFn: (id: string) => deleteGroceryItemFn({ data: id }),
    optimisticUpdate: (id: string) => {
      const hhId = session?.householdId ?? ''
      return [
        {
          queryKey: ['grocery-items', hhId] as string[],
          previousData: undefined,
          patch: (_prev: unknown) => {
            // Optimistically remove the item from the cache
            if (!_prev || !Array.isArray(_prev)) return _prev
            return (_prev as any[]).filter((i: any) => i.id !== id)
          },
        },
        {
          queryKey: ['grocery-items-grouped', hhId] as string[],
          previousData: undefined,
          patch: (_prev: unknown) => {
            if (!_prev || typeof _prev !== 'object' || _prev === null) return _prev
            const result = { ...(_prev as Record<string, any>) }
            for (const key of Object.keys(result)) {
              if (result[key]?.items) {
                result[key] = {
                  ...result[key],
                  items: result[key].items.filter((i: any) => i.id !== id),
                }
              }
            }
            return result
          },
        },
      ]
    },
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
    undoRollback: async (id) => {
      // Undo a delete by restoring the item (unchecking it)
      await updateGroceryItemFn({ data: { id: id as string, data: { checked: 'false' } } })
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

  const handleEdit = (item: GroceryItem) => {
    setEditingItem(item)
  }

  const handleEditorClose = () => {
    setEditingItem(null)
  }

  const handleEditorSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
    setEditingItem(null)
  }

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

  // Filter out completed items and empty groups
  const visibleData = Object.entries(groupedData).reduce(
    (acc: Record<string, { items: GroceryItem[]; category?: { name: string }; store?: { name: string } }>, [id, group]: [string, any]) => {
      const activeItems = group.items.filter((i: GroceryItem) => i.checked === 'false')
      if (activeItems.length > 0) {
        acc[id] = { ...group, items: activeItems }
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

      {/* ── Item Editor (rendered as dialog outside the grid) ── */}
      {editingItem && (
        <ItemEditor
          key={editingItem.id}
          isOpen={editingItem !== null}
          onClose={handleEditorClose}
          item={editingItem}
          categories={categories}
          stores={stores}
          activeItems={activeItems}
          onSaved={handleEditorSaved}
        />
      )}
    </div>
  )
}
