import { Home, History, Settings, Plus, Zap } from 'lucide-react'
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

  const isActive = (path: string) => pathname === path

  return (
    <nav
      className={styles.mobileNav}
      aria-label="Primary navigation"
      data-mobile-nav
    >
      <Link
        to="/"
        className={`${styles.navItem} ${isActive('/') ? styles.navItemActive : ''}`}
      >
        <Home className={styles.navIcon} />
        <span className={styles.navLabel}>Home</span>
      </Link>
      <Link
        to="/quick-add"
        className={`${styles.navItem} ${isActive('/quick-add') ? styles.navItemActive : ''}`}
      >
        <Zap className={styles.navIcon} />
        <span className={styles.navLabel}>Quick Add</span>
      </Link>
      <div className={styles.fabWrapper}>
        <button
          ref={fabRef}
          type="button"
          className={styles.fab}
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
      >
        <History className={styles.navIcon} />
        <span className={styles.navLabel}>Activity</span>
      </Link>
      <Link
        to="/admin"
        className={`${styles.navItem} ${isActive('/admin') ? styles.navItemActive : ''}`}
      >
        <Settings className={styles.navIcon} />
        <span className={styles.navLabel}>Admin</span>
      </Link>
    </nav>
  )
}
