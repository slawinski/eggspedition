import { Home, History, Settings, Plus, User } from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import styles from './MobileNav.module.css'

interface MobileNavProps {
  onOpenActivity: () => void
  onOpenAdmin: () => void
  onOpenAdd: () => void
}

export default function MobileNav({ onOpenActivity, onOpenAdmin, onOpenAdd }: MobileNavProps) {
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

      <button onClick={onOpenActivity} className={styles.navItem}>
        <History className={styles.navIcon} />
        <span className={styles.navLabel}>Activity</span>
      </button>

      <div className={styles.fabWrapper}>
        <button onClick={onOpenAdd} className={styles.fab} aria-label="Add Item">
          <Plus className={styles.fabIcon} />
        </button>
      </div>

      <button onClick={onOpenAdmin} className={styles.navItem}>
        <Settings className={styles.navIcon} />
        <span className={styles.navLabel}>Admin</span>
      </button>

      <Link to="/about" className={styles.navItem}>
        <User className={styles.navIcon} />
        <span className={styles.navLabel}>About</span>
      </Link>
    </nav>
  )
}
