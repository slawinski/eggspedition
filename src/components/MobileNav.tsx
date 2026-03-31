import { Home, History, Settings, Plus, Zap } from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import styles from './MobileNav.module.css'

export default function MobileNav() {
  const state = useRouterState()
  const pathname = state.location.pathname

  const isActive = (path: string) => pathname === path

  return (
    <nav className={styles.mobileNav}>
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
        <Link 
          to="/add" 
          className={styles.fab} 
          aria-label="Add Item"
        >
          <Plus className={styles.fabIcon} />
        </Link>
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
