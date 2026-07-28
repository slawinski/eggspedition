import { useState, useMemo, useRef, useEffect } from 'react'
import {
  ArrowLeft,
  X,
  MoreHorizontal,
  CheckCircle2,
  ChevronDown,
  Store,
  Trash2,
  PartyPopper,
  PackageOpen,
} from 'lucide-react'
import type { GroceryItem, Store as StoreType, Category, Session } from '../lib/schemas'
import ItemRow from './ItemRow'
import styles from './ShoppingMode.module.css'

// ── Props ─────────────────────────────────────────────────────

export interface ShoppingModeProps {
  session: Session | null
  selectedStoreId: string | 'all'
  groupedData: Record<string, { items: GroceryItem[]; category?: { name: string }; store?: { name: string } }>
  stores: StoreType[]
  categories: Category[]
  onExit: () => void
  onChangeStore: (storeId: string | 'all') => void
  onPickNewStore: () => void
  onComplete: (item: GroceryItem) => void
  onDelete: (item: GroceryItem) => void
}

// ── Helpers ──────────────────────────────────────────────────

function getStoreName(
  storeId: string | 'all',
  stores: StoreType[],
): string {
  if (storeId === 'all') return 'All items'
  const store = stores.find((s) => s.id === storeId)
  return store?.name ?? 'Unknown store'
}

// ── Component ────────────────────────────────────────────────

export default function ShoppingMode({
  session: _session,
  selectedStoreId,
  groupedData,
  stores,
  categories,
  onExit,
  onPickNewStore,
  onComplete,
  onDelete,
}: ShoppingModeProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [completedExpanded, setCompletedExpanded] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // ── Close overflow menu on outside click / Escape ──────────
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [menuOpen])

  // ── Flatten & scope items ──────────────────────────────────

  const { activeItems, completedItems } = useMemo(() => {
    const active: GroceryItem[] = []
    const completed: GroceryItem[] = []

    for (const group of Object.values(groupedData)) {
      for (const item of group.items) {
        // Scope filter
        if (selectedStoreId !== 'all' && item.storeId !== selectedStoreId) {
          continue
        }

        if (item.checked === 'true') {
          completed.push(item)
        } else {
          active.push(item)
        }
      }
    }

    return { activeItems: active, completedItems: completed }
  }, [groupedData, selectedStoreId])

  const totalItems = activeItems.length + completedItems.length
  const completedCount = completedItems.length
  const progress = totalItems > 0 ? (completedCount / totalItems) * 100 : 0
  const isScopeComplete = activeItems.length === 0
  const isScopeEmpty = totalItems === 0

  const storeName = getStoreName(selectedStoreId, stores)

  // ── Edit handler (placeholder for UX-005) ──────────────────
  const handleEdit = (_item: GroceryItem) => {
    // placeholder
  }

  // ── Render: Empty scope ───────────────────────────────────
  if (isScopeEmpty) {
    return (
      <div className={styles.container}>
        {/* Progress header (minimal) */}
        <div className={styles.progressHeader}>
          <div className={styles.progressRow}>
            <button
              type="button"
              className={styles.backButton}
              onClick={onExit}
              aria-label="Exit shopping mode"
            >
              <ArrowLeft className={styles.backIcon} aria-hidden="true" />
            </button>
            <div className={styles.centerInfo}>
              <span className={styles.storeName}>{storeName}</span>
            </div>
          </div>
        </div>

        {/* Empty state */}
        <div className={styles.emptyShopping}>
          <PackageOpen className={styles.emptyIcon} aria-hidden="true" />
          <h2 className={styles.emptyTitle}>
            Nothing to buy at {storeName === 'All items' ? 'any store' : storeName}
          </h2>
          <button
            type="button"
            className={styles.emptyAction}
            onClick={() => onPickNewStore()}
          >
            Shop another store
          </button>
        </div>
      </div>
    )
  }

  // ── Render: All complete ──────────────────────────────────
  if (isScopeComplete) {
    return (
      <div className={styles.container}>
        {/* Progress header */}
        <div className={styles.progressHeader}>
          <div className={styles.progressRow}>
            <button
              type="button"
              className={styles.backButton}
              onClick={onExit}
              aria-label="Exit shopping mode"
            >
              <ArrowLeft className={styles.backIcon} aria-hidden="true" />
            </button>
            <div className={styles.centerInfo}>
              <span className={styles.storeName}>{storeName}</span>
              <span className={styles.progressText}>
                {completedCount} of {totalItems} done
              </span>
            </div>
            {/* Overflow menu */}
            <div className={styles.overflowWrapper} ref={menuRef}>
              <button
                type="button"
                className={styles.overflowButton}
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="More actions"
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal className={styles.overflowIcon} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className={styles.menuDropdown} role="menu">
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onPickNewStore()
                    }}
                  >
                    <Store className={styles.menuItemIcon} aria-hidden="true" />
                    Change store
                  </button>
                  <button
                    type="button"
                    className={styles.menuItem}
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onExit()
                    }}
                  >
                    <X className={styles.menuItemIcon} aria-hidden="true" />
                    End trip
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className={styles.progressBar}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Scope complete card */}
        <div className={styles.scrollArea}>
          <div className={styles.scopeComplete}>
            <PartyPopper className={styles.scopeCompleteIcon} aria-hidden="true" />
            <h2 className={styles.scopeCompleteTitle}>
              That's everything for {storeName === 'All items' ? 'today' : storeName}
            </h2>
            <div className={styles.scopeCompleteActions}>
              <button
                type="button"
                className={`${styles.scopeAction} ${styles.scopeActionOutline}`}
                onClick={() => setCompletedExpanded(true)}
              >
                Review completed
              </button>
              <button
                type="button"
                className={`${styles.scopeAction} ${styles.scopeActionMint}`}
                onClick={() => onPickNewStore()}
              >
                Shop another store
              </button>
              <button
                type="button"
                className={`${styles.scopeAction} ${styles.scopeActionGhost}`}
                onClick={onExit}
              >
                Finish shopping
              </button>
            </div>
          </div>

          {/* Completed section (when review is clicked) */}
          {completedExpanded && completedCount > 0 && (
            <div className={styles.completedSection}>
              <div className={styles.completedList}>
                {completedItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    groupBy="store"
                    stores={stores}
                    categories={categories}
                    onComplete={onComplete}
                    onDelete={onDelete}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Render: Active shopping ────────────────────────────────
  return (
    <div className={styles.container}>
      {/* ── Sticky progress header ── */}
      <div className={styles.progressHeader}>
        <div className={styles.progressRow}>
          <button
            type="button"
            className={styles.backButton}
            onClick={onExit}
            aria-label="Exit shopping mode"
          >
            <ArrowLeft className={styles.backIcon} aria-hidden="true" />
          </button>
          <div className={styles.centerInfo}>
            <span className={styles.storeName}>{storeName}</span>
            <span className={styles.progressText}>
              {completedCount} of {totalItems} done
            </span>
          </div>
          {/* Overflow menu */}
          <div className={styles.overflowWrapper} ref={menuRef}>
            <button
              type="button"
              className={styles.overflowButton}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="More actions"
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className={styles.overflowIcon} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className={styles.menuDropdown} role="menu">
                <button
                  type="button"
                  className={styles.menuItem}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onPickNewStore()
                  }}
                >
                  <Store className={styles.menuItemIcon} aria-hidden="true" />
                  Change store
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onExit()
                  }}
                >
                  <X className={styles.menuItemIcon} aria-hidden="true" />
                  End trip
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className={styles.progressBar}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── Single-column item list ── */}
      <div className={styles.scrollArea}>
        {activeItems.map((item) => (
          <div key={item.id} className={styles.shoppingItemWrapper}>
            <ItemRow
              item={item}
              groupBy="store"
              stores={stores}
              categories={categories}
              onComplete={onComplete}
              onDelete={onDelete}
              onEdit={handleEdit}
            />
          </div>
        ))}

        {/* ── Completed section ── */}
        {completedCount > 0 && (
          <div className={styles.completedSection}>
            <button
              type="button"
              className={styles.completedToggle}
              onClick={() => setCompletedExpanded((prev) => !prev)}
              aria-expanded={completedExpanded}
              aria-controls="shopping-completed-list"
            >
              <span className={styles.completedToggleLabel}>
                <CheckCircle2
                  className={styles.completedCheckIcon}
                  aria-hidden="true"
                />
                Completed
                <span className={styles.completedCount}>{completedCount}</span>
              </span>
              <ChevronDown
                className={`${styles.chevronIcon} ${completedExpanded ? styles.chevronIconOpen : ''}`}
                aria-hidden="true"
              />
            </button>

            {completedExpanded && (
              <div id="shopping-completed-list" className={styles.completedList}>
                {completedItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    groupBy="store"
                    stores={stores}
                    categories={categories}
                    onComplete={onComplete}
                    onDelete={onDelete}
                    onEdit={handleEdit}
                  />
                ))}
                {/*
                  "Clear completed" — delete each completed item
                  silently in sequence
                */}
                <button
                  type="button"
                  className={styles.clearCompletedButton}
                  onClick={() => {
                    completedItems.forEach((item) => onDelete(item))
                  }}
                  aria-label="Clear all completed items"
                >
                  <Trash2
                    className={styles.clearCompletedIcon}
                    aria-hidden="true"
                  />
                  Clear completed
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
