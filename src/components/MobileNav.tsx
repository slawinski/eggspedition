import { Home, History, Settings, Plus, Zap } from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import styles from './MobileNav.module.css'

interface MobileNavProps {
  onOpenActivity: () => void
  onOpenAdmin: () => void
  onOpenAdd: () => void
  onOpenQuickAdd: () => void
}

export default function MobileNav({ onOpenActivity, onOpenAdmin, onOpenAdd, onOpenQuickAdd }: MobileNavProps) {
  const state = useRouterState()
  const isHome = state.location.pathname === '/'

  return (
    <nav className={styles.mobileNav}>
      <Link 
        to="/" 
        className={`${styles.navItem} ${isHome ? styles.navItemActive : ''}`}
      >
        <Home className={styles.navIcon} />
        <span className={styles.navLabel}>Home</span>
      </Link>

      <button onClick={onOpenQuickAdd} className={styles.navItem}>
        <Zap className={styles.navIcon} />
        <span className={styles.navLabel}>Quick Add</span>
      </button>

      <div className={styles.fabWrapper}>
        <button onClick={onOpenAdd} className={styles.fab} aria-label="Add Item">
          <Plus className={styles.fabIcon} />
        </button>
      </div>

      <button onClick={onOpenActivity} className={styles.navItem}>
        <History className={styles.navIcon} />
        <span className={styles.navLabel}>Activity</span>
      </button>

      <button onClick={onOpenAdmin} className={styles.navItem}>
        <Settings className={styles.navIcon} />
        <span className={styles.navLabel}>Admin</span>
      </button>
    </nav>
  )
}
