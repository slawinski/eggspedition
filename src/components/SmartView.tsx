import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  TouchSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { getGroceryItemsGroupedFn, updateGroceryItemFn, deleteGroceryItemFn, addGroceryItemFn, getStoresFn, getCategoriesFn } from '../services/grocery.api'
import styles from './SmartView.module.css'
import rowStyles from './ItemRow.module.css'
import { Tag, Store as StoreIcon, Circle, MoreHorizontal } from 'lucide-react'
import type { GroceryItem, Session } from '../lib/schemas'
import { useOptimisticMutation } from '../hooks/useOptimisticMutation'
import { createCompleteCommand, createRestoreCommand, createDeleteCommand } from '../lib/mutation-commands'
import { moveItemBetweenGroups, updateItemInList, type ItemMoveVars } from '../lib/grouped-cache'
import ItemRow from './ItemRow'
import GroupCard from './GroupCard'
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
      const patches: {
        queryKey: string[]
        previousData: undefined
        patch: (prev: unknown) => unknown
      }[] = [
        {
          queryKey: ['grocery-items', hhId],
          previousData: undefined,
          patch: (_prev: unknown) => {
            // Transform the cache optimistically: update the item's checked state
            if (!_prev || !Array.isArray(_prev)) return _prev
            return (_prev as any[]).map((i: any) =>
              i.id === vars.id ? { ...i, checked: vars.checked } : i,
            )
          },
        },
      ]

      // The grouped query key is ['grocery-items-grouped', groupBy, hhId] —
      // patch both dimension variants (at most one is cached).
      for (const dimension of ['category', 'store'] as const) {
        patches.push({
          queryKey: ['grocery-items-grouped', dimension, hhId],
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
        })
      }

      return patches
    },
    invalidationKeys: [
      ['grocery-items', session?.householdId ?? ''],
      ['grocery-items-grouped'],
      ['household-logs', session?.householdId ?? ''],
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
      const patches: {
        queryKey: string[]
        previousData: undefined
        patch: (prev: unknown) => unknown
      }[] = [
        {
          queryKey: ['grocery-items', hhId],
          previousData: undefined,
          patch: (_prev: unknown) => {
            // Optimistically remove the item from the cache
            if (!_prev || !Array.isArray(_prev)) return _prev
            return (_prev as any[]).filter((i: any) => i.id !== id)
          },
        },
      ]

      // The grouped query key is ['grocery-items-grouped', groupBy, hhId] —
      // patch both dimension variants (at most one is cached).
      for (const dimension of ['category', 'store'] as const) {
        patches.push({
          queryKey: ['grocery-items-grouped', dimension, hhId],
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
        })
      }

      return patches
    },
    invalidationKeys: [
      ['grocery-items', session?.householdId ?? ''],
      ['grocery-items-grouped'],
      ['household-logs', session?.householdId ?? ''],
    ],
    commandFactory: (_, id) => {
      const item = findItemById(id as string, groupedData as Record<string, { items: GroceryItem[] }> | undefined)
      if (!item) return null
      return createDeleteCommand(item, session?.householdId ?? '')
    },
    undoRollback: async (_id, command) => {
      // Undo a delete by re-adding the item with its original data
      const snap = command.previousSnapshot ?? command.itemSnapshot
      await addGroceryItemFn({
        data: {
          name: snap.name,
          quantity: snap.quantity,
          categoryId: snap.categoryId ?? undefined,
          storeId: snap.storeId ?? undefined,
        },
      })
    },
  })

  // ── Move mutation (drag & drop between buckets) ─────────────

  const moveMutation = useOptimisticMutation<unknown, ItemMoveVars>({
    mutationFn: (vars) =>
      updateGroceryItemFn({
        data: { id: vars.id, data: { ...vars.data } },
      }),
    optimisticUpdate: (vars) => {
      const hhId = session?.householdId ?? ''
      return [
        {
          queryKey: ['grocery-items-grouped', groupBy, hhId] as string[],
          previousData: undefined,
          patch: (prev: unknown) => moveItemBetweenGroups(prev, vars),
        },
        {
          queryKey: ['grocery-items', hhId] as string[],
          previousData: undefined,
          patch: (prev: unknown) => updateItemInList(prev, vars),
        },
      ]
    },
    invalidationKeys: [
      ['grocery-items', session?.householdId ?? ''],
      ['grocery-items-grouped'],
      ['household-logs', session?.householdId ?? ''],
    ],
  })

  // ── Drag & drop sensors / state ─────────────────────────────

  // TouchSensor owns touch input (long-press; touch events can preventDefault,
  // the only reliable scroll-prevention on iOS Safari). PointerSensor owns
  // mouse/pen — gated at the listener level below so it never activates from
  // touch, avoiding double-activation with the TouchSensor.
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 500, tolerance: 8 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const [activeDragItem, setActiveDragItem] = useState<GroceryItem | null>(null)
  const [justMovedId, setJustMovedId] = useState<string | null>(null)
  const justMovedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Snap-back animation for cancelled drops; skipped after a successful move
  const [dropAnimation, setDropAnimation] = useState<{ duration: number; easing: string } | null>({
    duration: 220,
    easing: 'ease',
  })

  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current?.item as GroceryItem | undefined
    if (!item) return
    setActiveDragItem(item)
    setDropAnimation({ duration: 220, easing: 'ease' })
    // Haptic confirmation on pickup (Android; no-op elsewhere)
    navigator.vibrate?.(12)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const item = event.active.data.current?.item as GroceryItem | undefined
    setActiveDragItem(null)

    if (!item) return
    const targetKey = (event.over?.data.current as { groupId?: string } | undefined)?.groupId
    if (!targetKey) return

    const currentKey =
      (groupBy === 'category' ? item.categoryId : item.storeId) || 'unassigned'
    if (targetKey === currentKey) return

    const newValue = targetKey === 'unassigned' ? null : targetKey
    moveMutation.mutate({
      id: item.id,
      data:
        groupBy === 'category'
          ? { categoryId: newValue }
          : { storeId: newValue },
    })

    // The item now lives in another bucket — no return animation
    setDropAnimation(null)

    // Squash-and-stretch settle animation on the row in its new bucket
    setJustMovedId(item.id)
    if (justMovedTimerRef.current) clearTimeout(justMovedTimerRef.current)
    justMovedTimerRef.current = setTimeout(() => setJustMovedId(null), 400)
  }

  const handleDragCancel = () => {
    setActiveDragItem(null)
    setDropAnimation({ duration: 220, easing: 'ease' })
  }

  useEffect(() => {
    return () => {
      if (justMovedTimerRef.current) clearTimeout(justMovedTimerRef.current)
    }
  }, [])

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
      {moveMutation.isError && moveMutation.error instanceof Error && (
        <InlineError
          message="Couldn't move item."
          onRetry={() => moveMutation.variables && moveMutation.mutate(moveMutation.variables as ItemMoveVars)}
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className={styles.masonryGrid}>
          {allEntries.length === 0 ? (
            <EmptyState
              title="Your list is clear!"
              body="Add some items with the + button below to get started."
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
                    <GroupCard
                      key={id}
                      groupId={id}
                      label={label}
                      groupBy={groupBy}
                      icon={<Icon className={styles.groupIcon} />}
                      dragActive={activeDragItem !== null}
                    >
                      {group.items.map((item: GroceryItem) => (
                        <DraggableItemRow
                          key={item.id}
                          item={item}
                          groupBy={groupBy}
                          stores={stores}
                          categories={categories}
                          onComplete={handleComplete}
                          onDelete={handleDelete}
                          onEdit={handleEdit}
                          justMoved={justMovedId === item.id}
                        />
                      ))}
                    </GroupCard>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeDragItem && (
            <ItemDragPreview
              item={activeDragItem}
              groupBy={groupBy}
              stores={stores}
              categories={categories}
            />
          )}
        </DragOverlay>
      </DndContext>

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

// ── Draggable wrapper + drag preview ─────────────────────────

interface RowDragProps {
  item: GroceryItem
  groupBy: 'category' | 'store'
  stores?: any[]
  categories?: any[]
  onComplete: (item: GroceryItem) => void
  onDelete: (item: GroceryItem) => void
  onEdit: (item: GroceryItem) => void
  justMoved?: boolean
}

function DraggableItemRow(props: RowDragProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.item.id,
    data: { item: props.item },
    // No KeyboardSensor is registered, so the row shouldn't present itself
    // as a focusable draggable button (it also nests real buttons inside).
    attributes: {
      role: undefined,
      tabIndex: -1,
      roleDescription: undefined,
    },
  })

  // Touch input is owned by the TouchSensor — keep the PointerSensor's
  // onPointerDown from ever activating on touch (it would double-activate
  // and its preventDefault can't stop scrolling on iOS Safari).
  const gatedListeners = useMemo(() => {
    const gated: Record<string, unknown> = {}
    for (const [key, handler] of Object.entries(listeners ?? {})) {
      if (key === 'onPointerDown') {
        gated[key] = (e: React.PointerEvent) => {
          if (e.pointerType === 'touch') return
          ;(handler as (e: React.PointerEvent) => void)(e)
        }
      } else {
        gated[key] = handler
      }
    }
    return gated
  }, [listeners])

  return (
    <ItemRow
      {...props}
      dragProps={{ ref: setNodeRef, ...attributes, ...gatedListeners }}
      dimmed={isDragging}
    />
  )
}

function ItemDragPreview({
  item,
  groupBy,
  stores,
  categories,
}: {
  item: GroceryItem
  groupBy: 'category' | 'store'
  stores?: any[]
  categories?: any[]
}) {
  const hasQuantity = item.quantity !== '1'
  const subLabel =
    groupBy === 'category' && item.storeId
      ? stores?.find((s: any) => s.id === item.storeId)?.name
      : groupBy === 'store' && item.categoryId
        ? categories?.find((c: any) => c.id === item.categoryId)?.name
        : null

  return (
    <div className={`${rowStyles.row} ${rowStyles.dragPreview}`} aria-hidden="true">
      <span className={rowStyles.checkbox}>
        <Circle className={rowStyles.checkIcon} />
      </span>
      <span className={`${rowStyles.body}`}>
        <span className={rowStyles.nameRow}>
          <span className={rowStyles.name}>{item.name}</span>
          {hasQuantity && (
            <span className={rowStyles.quantityBadge}>x{item.quantity}</span>
          )}
        </span>
        <span className={rowStyles.metaRow}>
          {subLabel && (
            <span
              className={`${rowStyles.subTag} ${
                groupBy === 'category' ? rowStyles.subTagStore : rowStyles.subTagCategory
              }`}
            >
              {subLabel}
            </span>
          )}
        </span>
      </span>
      <span className={rowStyles.overflowButton}>
        <MoreHorizontal className={rowStyles.overflowIcon} />
      </span>
    </div>
  )
}
