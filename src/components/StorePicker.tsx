import { useRef, useEffect } from 'react'
import { Store, ShoppingCart } from 'lucide-react'
import type { GroceryItem, Store as StoreType, Session } from '../lib/schemas'
import styles from './StorePicker.module.css'

const STORE_PREF_PREFIX = 'eggspedition:last-store:'

interface StorePickerProps {
  session: Session | null
  groupedData: Record<string, { items: GroceryItem[]; store?: { name: string }; category?: { name: string } }> | undefined
  stores: StoreType[]
  selectedStoreId: string | 'all'
  onSelect: (storeId: string | 'all') => void
  onCancel: () => void
}

/**
 * StorePicker — A bottom sheet for choosing which store to shop at.
 *
 * Shows all stores with active (unchecked) item counts plus an "All items"
 * option. Remembers the last selected store in localStorage per household.
 */
export default function StorePicker({
  session,
  groupedData,
  stores,
  selectedStoreId,
  onSelect,
  onCancel,
}: StorePickerProps) {
  const preferenceKey = `${STORE_PREF_PREFIX}${session?.householdId ?? ''}`
  const overlayRef = useRef<HTMLDivElement>(null)

  // Persist preference on selection
  const handleSelect = (storeId: string | 'all') => {
    try {
      localStorage.setItem(preferenceKey, storeId)
    } catch {
      // localStorage unavailable, ignore
    }
    onSelect(storeId)
  }

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancel])

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onCancel()
  }

  // Compute active (unchecked) item counts per store.
  // groupedData is keyed by storeId when grouped by store.
  const computeCounts = (): { storeId: string; name: string; count: number }[] => {
    if (!groupedData) return []

    return Object.entries(groupedData)
      .map(([storeId, group]) => {
        const store = stores.find((s) => s.id === storeId)
        const name = store?.name ?? group.store?.name ?? 'Unknown'
        const count = group.items.filter((item) => item.checked !== 'true').length
        return { storeId, name, count } as const
      })
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count)
  }

  // Compute total active items for "All items"
  const computeTotalActive = (): number => {
    if (!groupedData) return 0
    let total = 0
    for (const group of Object.values(groupedData)) {
      for (const item of group.items) {
        if (item.checked !== 'true') total++
      }
    }
    return total
  }

  const storeCounts = computeCounts()
  const totalActive = computeTotalActive()

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Choose a store to shop"
    >
      <section className={styles.sheet}>
        {/* Handle indicator */}
        <div className={styles.handle}>
          <div className={styles.handleBar} />
        </div>

        {/* Header */}
        <header className={styles.header}>
          <h2 className={styles.title}>Start Shopping</h2>
          <p className={styles.subtitle}>Choose a store or shop everything</p>
        </header>

        {/* Options list */}
        <div className={styles.list} role="listbox">
          {/* "All items" option */}
          <button
            type="button"
            role="option"
            aria-selected={selectedStoreId === 'all'}
            className={`${styles.option} ${styles.optionAll} ${selectedStoreId === 'all' ? styles.optionSelected : ''}`}
            onClick={() => handleSelect('all')}
          >
            <span className={styles.optionLeft}>
              <ShoppingCart className={styles.optionIcon} aria-hidden="true" />
              <span className={styles.optionName}>All items</span>
            </span>
            <span className={styles.count}>{totalActive}</span>
          </button>

          {/* Individual stores */}
          {storeCounts.map(({ storeId, name, count }) => (
            <button
              key={storeId}
              type="button"
              role="option"
              aria-selected={selectedStoreId === storeId}
              className={`${styles.option} ${selectedStoreId === storeId ? styles.optionSelected : ''}`}
              onClick={() => handleSelect(storeId)}
            >
              <span className={styles.optionLeft}>
                <Store className={styles.optionIcon} aria-hidden="true" />
                <span className={styles.optionName}>{name}</span>
              </span>
              <span className={styles.count}>{count}</span>
            </button>
          ))}

          {/* No stores with items */}
          {storeCounts.length === 0 && totalActive === 0 && (
            <p style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--sea-ink-soft)', fontSize: '0.875rem', fontWeight: 600 }}>
              No items to buy yet. Add some items first!
            </p>
          )}
        </div>

        {/* Cancel button */}
        <div className={styles.cancelRow}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  )
}
