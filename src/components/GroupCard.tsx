import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import clay from '../styles/clay.module.css'
import styles from './SmartView.module.css'

interface GroupCardProps {
  /** Category/store uuid, or 'unassigned' for the null bucket. */
  groupId: string
  label: string
  groupBy: 'category' | 'store'
  icon: ReactNode
  /** Whether any drag is in progress (shows the drop-zone hint). */
  dragActive: boolean
  children: ReactNode
}

/**
 * GroupCard — a masonry "bucket" of items, and a dnd-kit drop target.
 * Dropping an ItemRow here changes its categoryId/storeId to this group.
 */
export default function GroupCard({
  groupId,
  label,
  groupBy,
  icon,
  dragActive,
  children,
}: GroupCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: groupId,
    data: { groupId },
  })

  return (
    <div
      ref={setNodeRef}
      className={[
        clay.card,
        styles.groupCard,
        dragActive ? styles.groupCardDropZone : '',
        isOver ? styles.groupCardOver : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h3 className={styles.groupHeader}>
        <div
          className={`${styles.groupIconWrapper} ${
            groupBy === 'category'
              ? styles.groupIconWrapperCategory
              : styles.groupIconWrapperStore
          }`}
        >
          {icon}
        </div>
        <span className={styles.groupHeaderLabel}>{label}</span>
      </h3>
      <div className={styles.itemList}>{children}</div>
    </div>
  )
}
