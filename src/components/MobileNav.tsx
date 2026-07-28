import { History, ListChecks, Plus } from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import type { RefObject } from 'react'
import styles from './MobileNav.module.css'

interface MobileNavProps {
  fabRef: RefObject<HTMLButtonElement | null>
  isAddItemSheetOpen: boolean
  onAddClick: () => void
}

export default function MobileNav({
  fabRef,
  isAddItemSheetOpen,
  onAddClick,
}: MobileNavProps) {
  const state = useRouterState()
  const pathname = state.location.pathname

  const isActive = (path: string) => {
    // Exact match for root to avoid matching everything
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  return (
    <nav
      className={styles.mobileNav}
      aria-label="Primary navigation"
      data-mobile-nav
    >
      <Link
        to="/"
        className={`${styles.navItem} ${isActive('/') ? styles.navItemActive : ''}`}
        aria-current={isActive('/') ? 'page' : undefined}
      >
        <ListChecks
          className={styles.navIcon}
          aria-hidden="true"
        />
        <span className={styles.navLabel}>List</span>
      </Link>

      <div className={styles.fabWrapper}>
        <button
          ref={fabRef}
          type="button"
          className={`${styles.fab} ${isAddItemSheetOpen ? styles.fabOpen : ''}`}
          aria-label="Add item"
          aria-haspopup="dialog"
          aria-controls="add-item-sheet"
          aria-expanded={isAddItemSheetOpen}
          onClick={onAddClick}
        >
          <Plus aria-hidden="true" className={styles.fabIcon} />
        </button>
      </div>

      <Link
        to="/activity"
        className={`${styles.navItem} ${isActive('/activity') ? styles.navItemActive : ''}`}
        aria-current={
          isActive('/activity') ? 'page' : undefined
        }
      >
        <History
          className={styles.navIcon}
          aria-hidden="true"
        />
        <span className={styles.navLabel}>Activity</span>
      </Link>
    </nav>
  )
}
