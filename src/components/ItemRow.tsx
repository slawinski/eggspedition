import { Circle, CheckCircle2, MoreHorizontal, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { GroceryItem, Store, Category } from '../lib/schemas'
import styles from './ItemRow.module.css'

interface ItemRowProps {
  item: GroceryItem
  groupBy: 'category' | 'store'
  stores?: Store[]
  categories?: Category[]
  onComplete: (item: GroceryItem) => void
  onDelete: (item: GroceryItem) => void
  onEdit: (item: GroceryItem) => void
  /** dnd-kit props spread onto the row container (makes the row draggable). */
  dragProps?: {
    ref?: (node: HTMLDivElement | null) => void
    [key: string]: unknown
  }
  /** The row is the source of an active drag (visual dim). */
  dimmed?: boolean
  /** The item was just dropped into this bucket (settle animation). */
  justMoved?: boolean
}

export default function ItemRow({
  item,
  groupBy,
  stores,
  categories,
  onComplete,
  onDelete,
  onEdit,
  dragProps,
  dimmed = false,
  justMoved = false,
}: ItemRowProps) {
  const { ref: dragRef, ...dragRest } = dragProps ?? {}

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isChecked = item.checked === 'true'
  const hasQuantity = item.quantity !== '1'

  // Close overflow menu on outside click
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

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [menuOpen])

  const subLabel =
    groupBy === 'category' && item.storeId
      ? stores?.find((s) => s.id === item.storeId)?.name
      : groupBy === 'store' && item.categoryId
        ? categories?.find((c) => c.id === item.categoryId)?.name
        : null

  const subIcon =
    groupBy === 'category'
      ? 'store'
      : groupBy === 'store'
        ? 'category'
        : null

  return (
    <div
      ref={dragRef}
      {...dragRest}
      className={`${styles.row} ${isChecked ? styles.rowChecked : ''} ${dimmed ? styles.rowDimmed : ''} ${justMoved ? styles.rowJustMoved : ''}`}
    >
      {/* ── Checkbox area (40×40 dense mobile target; 44×44 desktop) ── */}
      <button
        type="button"
        className={styles.checkbox}
        onClick={() => onComplete(item)}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        aria-label={isChecked ? `Restore ${item.name}` : `Mark ${item.name} as completed`}
      >
        {isChecked ? (
          <CheckCircle2 className={`${styles.checkIcon} ${styles.checkIconActive}`} aria-hidden="true" />
        ) : (
          <Circle className={styles.checkIcon} aria-hidden="true" />
        )}
      </button>

      {/* ── Item body (center) ── */}
      <button
        type="button"
        className={styles.body}
        onClick={() => onEdit(item)}
        aria-label={`Edit ${item.name}`}
      >
        <span className={`${styles.name} ${isChecked ? styles.nameChecked : ''}`}>
          {item.name}
        </span>

        <div className={styles.metaRow}>
          {hasQuantity && (
            <span className={styles.quantityBadge}>x{item.quantity}</span>
          )}
          {subLabel && (
            <span className={`${styles.subTag} ${subIcon === 'store' ? styles.subTagStore : styles.subTagCategory}`}>
              {subLabel}
            </span>
          )}
        </div>
      </button>

      {/* ── Overflow menu (right, 44×44 minimum target) ── */}
      <div
        className={styles.overflowWrapper}
        ref={menuRef}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.overflowButton}
          onClick={() => setMenuOpen((prev) => !prev)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`More actions for ${item.name}`}
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className={styles.overflowIcon} />
        </button>

        {menuOpen && (
          <div className={styles.menuDropdown} role="menu">
            <button
              type="button"
              className={styles.menuItem}
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onEdit(item)
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className={`${styles.menuItem} ${styles.menuItemDanger}`}
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onDelete(item)
              }}
            >
              <Trash2 className={styles.menuItemIcon} aria-hidden="true" />
              Delete {item.name}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
