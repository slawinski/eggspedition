import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import {
  X, Minus, Plus, Search, Check, Tag, Store as StoreIcon, AlertTriangle,
} from 'lucide-react'
import type { GroceryItem, Category, Store } from '../lib/schemas'
import {
  updateGroceryItemFn, deleteGroceryItemFn,
  addCategoryFn, addStoreFn, addGroceryItemFn,
} from '../services/grocery.api'
import { useOptimisticMutation } from '../hooks/useOptimisticMutation'
import { createDeleteCommand } from '../lib/mutation-commands'
import { normalizeItemName } from '../lib/quickAddKey'
import { toItemSnapshot, type ReversibleCommand } from '../lib/commands'
import { useUndo } from '../hooks/useUndo'
import styles from './ItemEditor.module.css'

// ── types ──────────────────────────────────────────────────────

interface ItemEditorProps {
  isOpen: boolean
  onClose: () => void
  item: GroceryItem
  categories: Category[]
  stores: Store[]
  /** All active (unchecked) items from the household for merge detection. */
  activeItems: GroceryItem[]
  onSaved?: (updatedItem: GroceryItem) => void
}

// ── helpers ────────────────────────────────────────────────────

function findCategoryName(categories: Category[], id?: string | null): string | null {
  if (!id) return null
  return categories.find((c) => c.id === id)?.name ?? null
}

function findStoreName(stores: Store[], id?: string | null): string | null {
  if (!id) return null
  return stores.find((s) => s.id === id)?.name ?? null
}

// ── component ──────────────────────────────────────────────────

export default function ItemEditor({
  isOpen,
  onClose,
  item,
  categories,
  stores,
  activeItems,
  onSaved,
}: ItemEditorProps) {
  const { session } = useRouteContext({ from: '__root__' })
  const queryClient = useQueryClient()
  const undo = useUndo()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // ── field state ────────────────────────────────────────────

  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(item.quantity)
  const [categoryName, setCategoryName] = useState<string | null>(
    findCategoryName(categories, item.categoryId),
  )
  const [storeName, setStoreName] = useState<string | null>(
    findStoreName(stores, item.storeId),
  )

  // ── picker state ───────────────────────────────────────────

  const [activePicker, setActivePicker] = useState<'category' | 'store' | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')

  // ── version tracking for stale detection ───────────────────

  const versionTimestampRef = useRef(item.updatedAt)

  // ── merge / conflict state ─────────────────────────────────

  const [mergeWarning, setMergeWarning] = useState<GroceryItem | null>(null)
  const [conflict, setConflict] = useState<{
    serverItem: GroceryItem | null
    message: string
  } | null>(null)

  // ── status & error ─────────────────────────────────────────

  const [saveError, setSaveError] = useState<Error | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── capture original values for undo rollback ──────────────

  const originalValuesRef = useRef({
    name: item.name,
    quantity: item.quantity,
    categoryId: item.categoryId ?? null,
    storeId: item.storeId ?? null,
  })

  // ── dialog open / close ────────────────────────────────────

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
      // Reset state when opening
      versionTimestampRef.current = item.updatedAt
      setName(item.name)
      setQuantity(item.quantity)
      setCategoryName(findCategoryName(categories, item.categoryId))
      setStoreName(findStoreName(stores, item.storeId))
      setActivePicker(null)
      setPickerSearch('')
      setMergeWarning(null)
      setConflict(null)
      setSaveError(null)
      setStatusMessage('')
      originalValuesRef.current = {
        name: item.name,
        quantity: item.quantity,
        categoryId: item.categoryId ?? null,
        storeId: item.storeId ?? null,
      }
    }

    if (!isOpen && dialog.open) {
      dialog.close()
      resetStatusTimer()
    }
  }, [isOpen, item, categories, stores])

  function resetStatusTimer() {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current)
      statusTimerRef.current = null
    }
    setStatusMessage('')
  }

  // ── cleanup on unmount ─────────────────────────────────────

  useEffect(() => {
    return () => resetStatusTimer()
  }, [])

  // ── focus name field on desktop open ───────────────────────

  useEffect(() => {
    if (!isOpen) return
    const isDesktop = window.innerWidth >= 768
    if (isDesktop && nameInputRef.current) {
      requestAnimationFrame(() => {
        nameInputRef.current?.focus()
      })
    }
  }, [isOpen])

  // ── reset picker search when active picker changes ─────────

  useEffect(() => {
    setPickerSearch('')
  }, [activePicker])

  // ── show status briefly ────────────────────────────────────

  const showStatus = useCallback((msg: string) => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    setStatusMessage(msg)
    statusTimerRef.current = setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? '' : prev))
      statusTimerRef.current = null
    }, 3000)
  }, [])

  // ── dirty check ────────────────────────────────────────────

  const isDirty = useMemo(() => {
    const origCat = findCategoryName(categories, item.categoryId)
    const origStore = findStoreName(stores, item.storeId)
    return (
      name.trim() !== item.name ||
      quantity !== item.quantity ||
      categoryName !== origCat ||
      storeName !== origStore
    )
  }, [name, quantity, categoryName, storeName, item, categories, stores])

  const canSave = name.trim().length > 0 && isDirty

  // ── merge detection on name change ─────────────────────────

  useEffect(() => {
    if (!name.trim()) {
      setMergeWarning(null)
      return
    }
    const normalized = normalizeItemName(name)
    const match = activeItems.find(
      (gi) =>
        gi.id !== item.id &&
        gi.checked === 'false' &&
        normalizeItemName(gi.name) === normalized,
    )
    setMergeWarning(match ?? null)
  }, [name, item.id, activeItems])

  // ── resolve category / store ids ───────────────────────────

  function resolveCategoryId(): string | null {
    if (!categoryName) return null
    const existing = categories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase(),
    )
    return existing?.id ?? null
  }

  function resolveStoreId(): string | null {
    if (!storeName) return null
    const existing = stores.find(
      (s) => s.name.toLowerCase() === storeName.toLowerCase(),
    )
    return existing?.id ?? null
  }

  function needsCreateCategory(): boolean {
    if (!categoryName) return false
    return !categories.some(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase(),
    )
  }

  function needsCreateStore(): boolean {
    if (!storeName) return false
    return !stores.some(
      (s) => s.name.toLowerCase() === storeName.toLowerCase(),
    )
  }

  // ── build toast message for move / update ──────────────────

  function buildToastMessage(updatedItem: GroceryItem): string {
    const origCatName = findCategoryName(categories, item.categoryId)
    const origStoreName = findStoreName(stores, item.storeId)
    const newCatName = findCategoryName(categories, updatedItem.categoryId)
    const newStoreName = findStoreName(stores, updatedItem.storeId)

    if (newStoreName && newStoreName !== origStoreName) {
      return `${updatedItem.name} moved to ${newStoreName}.`
    }
    if (newCatName && newCatName !== origCatName) {
      return `${updatedItem.name} moved to ${newCatName}.`
    }
    return `${updatedItem.name} updated.`
  }

  // ── build optimistic cache patches ─────────────────────────

  function emptyCachePatches(): ReversibleCommand['optimisticCachePatches'] {
    const keys = [
      ['grocery-items', session?.householdId ?? ''],
      ['grocery-items-grouped', session?.householdId ?? ''],
      ['household-logs', session?.householdId ?? ''],
      ['frequent-items', session?.householdId ?? ''],
    ]
    return keys.map((queryKey) => ({
      queryKey,
      operation: 'set' as const,
      data: undefined,
    }))
  }

  // ── save mutation ──────────────────────────────────────────

  const saveMutation = useOptimisticMutation<
    GroceryItem,
    { id: string; data: { name?: string; quantity?: string; categoryId?: string | null; storeId?: string | null } }
  >({
    mutationFn: (vars) => updateGroceryItemFn({ data: vars }),
    invalidationKeys: [
      ['grocery-items', session?.householdId ?? ''],
      ['grocery-items-grouped', session?.householdId ?? ''],
      ['household-logs', session?.householdId ?? ''],
      ['frequent-items', session?.householdId ?? ''],
    ],
    commandFactory: (result, _vars) => {
      const updated = result as GroceryItem
      const previousSnapshot = toItemSnapshot(item)
      const newSnapshot = toItemSnapshot(updated)
      return {
        id: crypto.randomUUID(),
        type: 'incrementItem',
        householdId: session?.householdId ?? '',
        itemId: updated.id,
        itemSnapshot: newSnapshot,
        previousSnapshot,
        optimisticCachePatches: emptyCachePatches(),
        userMessage: buildToastMessage(updated),
        expiryTimestamp: Date.now() + 5000,
      }
    },
    undoRollback: async (_vars) => {
      // Revert to the original values captured when the editor opened
      const orig = originalValuesRef.current
      await updateGroceryItemFn({
        data: {
          id: item.id,
          data: {
            name: orig.name,
            quantity: orig.quantity,
            categoryId: orig.categoryId,
            storeId: orig.storeId,
          },
        },
      })
    },
    onSuccess: (data) => {
      const updated = data as GroceryItem
      showStatus(buildToastMessage(updated))
      onSaved?.(updated)
    },
    onError: (err) => {
      setSaveError(err)
    },
  })

  // ── delete mutation ────────────────────────────────────────

  const deleteMutation = useOptimisticMutation<unknown, string>({
    mutationFn: (id) => deleteGroceryItemFn({ data: id }),
    invalidationKeys: [
      ['grocery-items', session?.householdId ?? ''],
      ['grocery-items-grouped', session?.householdId ?? ''],
      ['household-logs', session?.householdId ?? ''],
      ['frequent-items', session?.householdId ?? ''],
      ['quick-add-items', session?.householdId ?? ''],
    ],
    commandFactory: () => {
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
    onSuccess: () => {
      onClose()
    },
  })

  // ── stale version check ────────────────────────────────────

  function getServerItem(): GroceryItem | undefined {
    // Check both grouped query caches
    const groupKeys: Array<[string, string, string]> = [
      ['grocery-items-grouped', 'category', session?.householdId ?? ''],
      ['grocery-items-grouped', 'store', session?.householdId ?? ''],
    ]
    for (const key of groupKeys) {
      const cached = queryClient.getQueryData<
        Record<string, { category?: { name: string }; store?: { name: string }; items: GroceryItem[] }>
      >(key)
      if (!cached) continue
      for (const group of Object.values(cached)) {
        const found = group.items.find((i: GroceryItem) => i.id === item.id)
        if (found) return found
      }
    }
    return undefined
  }

  // ── handle save ────────────────────────────────────────────

  async function handleSave() {
    if (!canSave) return
    setSaveError(null)

    // Stale version check
    const serverItem = getServerItem()
    if (!serverItem) {
      setConflict({ serverItem: null, message: 'This item was removed by another household member.' })
      return
    }
    if (serverItem.updatedAt !== versionTimestampRef.current) {
      setConflict({ serverItem, message: 'This item changed while you were editing.' })
      return
    }

    // Create new category / store if needed
    let finalCategoryId = resolveCategoryId()
    let finalStoreId = resolveStoreId()

    try {
      if (needsCreateCategory() && categoryName) {
        const newCat = (await addCategoryFn({ data: categoryName })) as Category
        finalCategoryId = newCat.id
        // Optimistically add to our categories list so the toast message resolves correctly
      }
      if (needsCreateStore() && storeName) {
        const newStore = (await addStoreFn({ data: storeName })) as Store
        finalStoreId = newStore.id
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err : new Error('Failed to create category or store'))
      return
    }

    // Merge path
    if (mergeWarning) {
      await handleMergeSave(finalCategoryId, finalStoreId)
      return
    }

    saveMutation.mutate({
      id: item.id,
      data: {
        name: name.trim(),
        quantity,
        categoryId: finalCategoryId,
        storeId: finalStoreId,
      },
    })
  }

  // ── handle merge ───────────────────────────────────────────

  async function handleMergeSave(finalCategoryId: string | null, finalStoreId: string | null) {
    if (!mergeWarning) return

    const newQty = String(
      (parseInt(quantity, 10) || 1) + (parseInt(mergeWarning.quantity, 10) || 1),
    )

    try {
      // 1. Update the edited item with summed quantity
      await updateGroceryItemFn({
        data: {
          id: item.id,
          data: {
            name: name.trim(),
            quantity: newQty,
            categoryId: finalCategoryId,
            storeId: finalStoreId,
          },
        },
      })

      // 2. Delete the duplicate
      await deleteGroceryItemFn({ data: mergeWarning.id })

      // 3. Invalidate all caches
      const keys = [
        ['grocery-items', session?.householdId ?? ''],
        ['grocery-items-grouped', session?.householdId ?? ''],
        ['household-logs', session?.householdId ?? ''],
        ['frequent-items', session?.householdId ?? ''],
        ['quick-add-items', session?.householdId ?? ''],
      ]
      await Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: k })))

      // 4. Push a combined undo command
      const mergedSnapshot = toItemSnapshot({
        ...item,
        name: name.trim(),
        quantity: newQty,
        categoryId: finalCategoryId,
        storeId: finalStoreId,
      })
      const deletedSnapshot = toItemSnapshot(mergeWarning)

      const mergeCmd: ReversibleCommand = {
        id: crypto.randomUUID(),
        type: 'incrementItem',
        householdId: session?.householdId ?? '',
        itemId: item.id,
        itemSnapshot: mergedSnapshot,
        previousSnapshot: toItemSnapshot(item),
        optimisticCachePatches: emptyCachePatches(),
        userMessage: 'Merged with existing item',
        expiryTimestamp: Date.now() + 5000,
      }

      // Custom rollback for merge: re-create the deleted duplicate + revert the kept item
      undo.pushCommand(mergeCmd, async () => {
        // Re-create the deleted duplicate
        await addGroceryItemFn({
          data: {
            name: deletedSnapshot.name,
            quantity: deletedSnapshot.quantity,
            categoryId: deletedSnapshot.categoryId ?? undefined,
            storeId: deletedSnapshot.storeId ?? undefined,
          },
        })
        // Reset the kept item's quantity back to original
        const orig = originalValuesRef.current
        await updateGroceryItemFn({
          data: {
            id: item.id,
            data: {
              name: orig.name,
              quantity: orig.quantity,
              categoryId: orig.categoryId,
              storeId: orig.storeId,
            },
          },
        })
      })

      showStatus('Merged with existing item')
      onSaved?.(item)
    } catch (err) {
      setSaveError(err instanceof Error ? err : new Error('Failed to merge items'))
    }
  }

  // ── conflict actions ───────────────────────────────────────

  function handleUseMyChanges() {
    if (!conflict) return
    setConflict(null)
    // Force save without re-checking staleness
    const finalCategoryId = resolveCategoryId()
    const finalStoreId = resolveStoreId()
    saveMutation.mutate({
      id: item.id,
      data: {
        name: name.trim(),
        quantity,
        categoryId: finalCategoryId,
        storeId: finalStoreId,
      },
    })
  }

  function handleReloadCurrent() {
    if (conflict?.serverItem) {
      const server = conflict.serverItem
      setName(server.name)
      setQuantity(server.quantity)
      setCategoryName(findCategoryName(categories, server.categoryId))
      setStoreName(findStoreName(stores, server.storeId))
      versionTimestampRef.current = server.updatedAt
      // Also update original values for potential undo
      originalValuesRef.current = {
        name: server.name,
        quantity: server.quantity,
        categoryId: server.categoryId ?? null,
        storeId: server.storeId ?? null,
      }
    }
    setConflict(null)
  }

  // ── quantity handlers ──────────────────────────────────────

  function handleQuantityChange(value: string) {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 1) {
      setQuantity('1')
    } else {
      setQuantity(String(num))
    }
  }

  // ── picker handlers ────────────────────────────────────────

  function togglePicker(picker: 'category' | 'store') {
    setActivePicker((prev) => (prev === picker ? null : picker))
  }

  function handleCategorySelect(selected: string | null) {
    setCategoryName(selected)
    setActivePicker(null)
  }

  function handleStoreSelect(selected: string | null) {
    setStoreName(selected)
    setActivePicker(null)
  }

  // ── filtered picker options ────────────────────────────────

  const filteredCategories = pickerSearch
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(pickerSearch.toLowerCase()),
      )
    : categories

  const filteredStores = pickerSearch
    ? stores.filter((s) =>
        s.name.toLowerCase().includes(pickerSearch.toLowerCase()),
      )
    : stores

  const categoryExactExists =
    pickerSearch &&
    filteredCategories.some(
      (c) => c.name.toLowerCase() === pickerSearch.toLowerCase(),
    )

  const storeExactExists =
    pickerSearch &&
    filteredStores.some(
      (s) => s.name.toLowerCase() === pickerSearch.toLowerCase(),
    )

  // ── dialog backdrop click ──────────────────────────────────

  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  function handleCancel(e: React.SyntheticEvent<HTMLDialogElement>) {
    e.preventDefault()
    onClose()
  }

  // ── desktop detection ──────────────────────────────────────

  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── render ─────────────────────────────────────────────────

  if (!isOpen) return null

  return (
    <dialog
      ref={dialogRef}
      id="item-editor"
      className={`${styles.dialog} ${isDesktop ? styles.dialogDesktop : ''}`}
      aria-labelledby="item-editor-title"
      onClick={handleDialogClick}
      onCancel={handleCancel}
    >
      <div className={styles.sheet}>
        {/* ── Header ── */}
        <div className={styles.header}>
          {!isDesktop && (
            <div className={styles.dragHandle} aria-hidden="true">
              <span className={styles.dragHandleBar} />
            </div>
          )}
          <div className={styles.headerRow}>
            <h2 id="item-editor-title" className={styles.title}>
              Edit item
            </h2>
            <button
              type="button"
              className={styles.closeButton}
              aria-label="Close editor"
              onClick={onClose}
            >
              <X aria-hidden="true" className={styles.closeIcon} />
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className={styles.scrollContent}>
          {/* Conflict banner */}
          {conflict && (
            <div className={styles.conflictBanner} role="alert">
              <AlertTriangle className={styles.conflictIcon} aria-hidden="true" />
              <p className={styles.conflictMessage}>{conflict.message}</p>
              {conflict.serverItem && (
                <div className={styles.conflictCompare}>
                  <div className={styles.conflictCol}>
                    <span className={styles.conflictLabel}>Current (server)</span>
                    <span>
                      {conflict.serverItem.name} &times;{conflict.serverItem.quantity}
                    </span>
                  </div>
                  <div className={styles.conflictCol}>
                    <span className={styles.conflictLabel}>Your edit</span>
                    <span>
                      {name.trim() || item.name} &times;{quantity}
                    </span>
                  </div>
                </div>
              )}
              <div className={styles.conflictActions}>
                <button
                  type="button"
                  className={styles.conflictBtnPrimary}
                  onClick={handleUseMyChanges}
                >
                  Use my changes
                </button>
                {conflict.serverItem && (
                  <button
                    type="button"
                    className={styles.conflictBtnSecondary}
                    onClick={handleReloadCurrent}
                  >
                    Reload current item
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Name field ── */}
          <div className={styles.field}>
            <label htmlFor="item-editor-name" className={styles.fieldLabel}>
              Name
            </label>
            <input
              ref={nameInputRef}
              id="item-editor-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.textInput}
              placeholder="Item name"
              required
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck
            />

            {/* Merge warning */}
            {mergeWarning && (
              <div className={styles.mergeWarning} role="status">
                <span className={styles.mergeText}>
                  &ldquo;{mergeWarning.name}&rdquo; is already on the list.
                </span>
                <div className={styles.mergeActions}>
                  <button
                    type="button"
                    className={styles.mergeBtnPrimary}
                    onClick={handleSave}
                  >
                    Merge quantities &rarr;
                  </button>
                  <button
                    type="button"
                    className={styles.mergeBtnSecondary}
                    onClick={() => setMergeWarning(null)}
                  >
                    Keep separate
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Quantity field ── */}
          <div className={styles.field}>
            <label htmlFor="item-editor-quantity" className={styles.fieldLabel}>
              Quantity
            </label>
            <div className={styles.stepper} role="group" aria-label="Quantity controls">
              <button
                type="button"
                className={styles.stepperBtn}
                disabled={parseInt(quantity, 10) <= 1}
                onClick={() =>
                  handleQuantityChange(String(Math.max(1, parseInt(quantity, 10) - 1)))
                }
                aria-label="Decrease quantity"
              >
                <Minus className={styles.stepperBtnIcon} />
              </button>
              <input
                id="item-editor-quantity"
                type="number"
                className={styles.stepperInput}
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                min="1"
                step="1"
                inputMode="numeric"
                aria-label="Quantity"
              />
              <button
                type="button"
                className={styles.stepperBtn}
                onClick={() =>
                  handleQuantityChange(String(parseInt(quantity, 10) + 1))
                }
                aria-label="Increase quantity"
              >
                <Plus className={styles.stepperBtnIcon} />
              </button>
            </div>
            <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
              Quantity is {quantity}
            </div>
          </div>

          {/* ── Category field ── */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Category</label>
            <button
              type="button"
              className={`${styles.pickerTrigger} ${activePicker === 'category' ? styles.pickerTriggerActive : ''} ${categoryName ? styles.pickerTriggerSet : ''}`}
              onClick={() => togglePicker('category')}
              aria-expanded={activePicker === 'category'}
            >
              <Tag className={styles.pickerTriggerIcon} />
              {categoryName || 'No category'}
            </button>

            {activePicker === 'category' && (
              <div className={styles.pickerDropdown} role="listbox">
                <div className={styles.pickerSearch}>
                  <Search className={styles.pickerSearchIcon} />
                  <input
                    type="text"
                    className={styles.pickerSearchInput}
                    placeholder="Search categories"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className={styles.pickerOptions}>
                  <button
                    type="button"
                    className={`${styles.pickerOption} ${!categoryName ? styles.pickerOptionSelected : ''}`}
                    onClick={() => handleCategorySelect(null)}
                    role="option"
                    aria-selected={!categoryName}
                  >
                    <span
                      className={`${styles.pickerRadio} ${!categoryName ? styles.pickerRadioChecked : ''}`}
                    />
                    No category
                  </button>
                  {filteredCategories.slice(0, 8).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`${styles.pickerOption} ${categoryName === cat.name ? styles.pickerOptionSelected : ''}`}
                      onClick={() => handleCategorySelect(cat.name)}
                      role="option"
                      aria-selected={categoryName === cat.name}
                    >
                      <span
                        className={`${styles.pickerRadio} ${categoryName === cat.name ? styles.pickerRadioChecked : ''}`}
                      />
                      {cat.name}
                    </button>
                  ))}
                  {pickerSearch && !categoryExactExists && pickerSearch.trim() && (
                    <button
                      type="button"
                      className={`${styles.pickerOption} ${styles.pickerOptionNew}`}
                      onClick={() => handleCategorySelect(pickerSearch.trim())}
                      role="option"
                    >
                      <Plus className={styles.pickerNewIcon} />
                      Create &ldquo;{pickerSearch.trim()}&rdquo;
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Store field ── */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Store</label>
            <button
              type="button"
              className={`${styles.pickerTrigger} ${activePicker === 'store' ? styles.pickerTriggerActive : ''} ${storeName ? styles.pickerTriggerSet : ''}`}
              onClick={() => togglePicker('store')}
              aria-expanded={activePicker === 'store'}
            >
              <StoreIcon className={styles.pickerTriggerIcon} />
              {storeName || 'No store'}
            </button>

            {activePicker === 'store' && (
              <div className={styles.pickerDropdown} role="listbox">
                <div className={styles.pickerSearch}>
                  <Search className={styles.pickerSearchIcon} />
                  <input
                    type="text"
                    className={styles.pickerSearchInput}
                    placeholder="Search stores"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className={styles.pickerOptions}>
                  <button
                    type="button"
                    className={`${styles.pickerOption} ${!storeName ? styles.pickerOptionSelected : ''}`}
                    onClick={() => handleStoreSelect(null)}
                    role="option"
                    aria-selected={!storeName}
                  >
                    <span
                      className={`${styles.pickerRadio} ${!storeName ? styles.pickerRadioChecked : ''}`}
                    />
                    No store
                  </button>
                  {filteredStores.slice(0, 8).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`${styles.pickerOption} ${storeName === s.name ? styles.pickerOptionSelected : ''}`}
                      onClick={() => handleStoreSelect(s.name)}
                      role="option"
                      aria-selected={storeName === s.name}
                    >
                      <span
                        className={`${styles.pickerRadio} ${storeName === s.name ? styles.pickerRadioChecked : ''}`}
                      />
                      {s.name}
                    </button>
                  ))}
                  {pickerSearch && !storeExactExists && pickerSearch.trim() && (
                    <button
                      type="button"
                      className={`${styles.pickerOption} ${styles.pickerOptionNew}`}
                      onClick={() => handleStoreSelect(pickerSearch.trim())}
                      role="option"
                    >
                      <Plus className={styles.pickerNewIcon} />
                      Create &ldquo;{pickerSearch.trim()}&rdquo;
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Error ── */}
          {saveError && (
            <div className={styles.errorBanner} role="alert">
              <span className={styles.errorText}>{saveError.message}</span>
              <button type="button" className={styles.retryBtn} onClick={handleSave}>
                Retry
              </button>
            </div>
          )}
        </div>

        {/* ── Status ── */}
        {statusMessage && (
          <div aria-live="polite" aria-atomic="true" className={styles.status}>
            <Check aria-hidden="true" className={styles.statusIcon} />
            {statusMessage}
          </div>
        )}

        {/* ── Footer ── */}
        <div className={styles.footer}>
          {/* Delete button */}
          <div className={styles.deleteSection}>
            <button
              type="button"
              className={styles.deleteButton}
              onClick={() => deleteMutation.mutate(item.id)}
              disabled={deleteMutation.isPending}
              aria-label={`Delete ${item.name}`}
            >
              Delete {item.name}
            </button>
          </div>

          {/* Save / Cancel */}
          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.saveButton}
              disabled={!canSave || saveMutation.isPending}
              onClick={handleSave}
              aria-busy={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving\u2026' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
