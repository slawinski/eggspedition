import { Link, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import ThemeToggle from './ThemeToggle'
import { ShoppingBasket, LogOut, User, ChevronDown, SlidersHorizontal, Settings } from 'lucide-react'
import SyncStatusButton from './ui/SyncStatusButton'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { logoutServerFn } from '../services/auth.api'
import { Route as rootRoute } from '../routes/__root'
import { useState, useRef, useEffect } from 'react'
import styles from './Header.module.css'

export default function Header() {
  const { session } = rootRoute.useRouteContext()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isOnline } = useOnlineStatus()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await logoutServerFn()
    queryClient.clear()
    // Only clear app-specific keys, not the entire localStorage
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('eggspedition:') || key.startsWith('REACT_QUERY'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
    router.invalidate()
  }

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <h1>
          <Link to="/" className={styles.logoLink}>
            <ShoppingBasket className={styles.logoIcon} />
            <span className={styles.logoText}>Eggspedition</span>
          </Link>
        </h1>

        {!session && (
          <div className={styles.publicNav}>
            <a href="#how-it-works" className={styles.publicNavLink}>How it works</a>
            <a href="#features" className={styles.publicNavLink}>Features</a>
            <ThemeToggle />
            <Link to="/login" className={styles.publicLoginLink}>Log in</Link>
            <Link to="/login" className={styles.publicPrimaryLink}>Start your list</Link>
          </div>
        )}

        {session && (
          <div className={styles.actions}>
            <SyncStatusButton
              isOnline={isOnline}
              pendingMutations={[]}
              failedMutations={[]}
              onRetry={() => {}}
              onDiscard={() => {}}
            />
            <ThemeToggle />

            <div className={styles.userMenu} ref={dropdownRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`${styles.userButton} ${isProfileOpen ? styles.userButtonActive : ''}`}
              >
                <div className={styles.userAvatar}>
                  <User className={styles.avatarIcon} />
                </div>
                <ChevronDown className={`${styles.chevronIcon} ${isProfileOpen ? styles.chevronIconRotated : ''}`} />
              </button>

              {isProfileOpen && (
                <div className={styles.dropdown}>
                  <div className={styles.accountInfo}>
                    <p className={styles.accountLabel}>Account</p>
                    <p className={styles.accountEmail}>{session.email}</p>
                  </div>

                  {session.householdId && (
                    <div className={styles.dropdownSection}>
                      <p className={styles.sectionLabel}>Household</p>
                      <Link
                        to="/settings/household"
                        onClick={() => setIsProfileOpen(false)}
                        className={styles.dropdownItem}
                      >
                        <Settings className={styles.dropdownIcon} aria-hidden="true" />
                        Household settings
                      </Link>
                    </div>
                  )}

                  <div className={styles.dropdownDivider} />

                  <div className={styles.dropdownSection}>
                    <p className={styles.sectionLabel}>Manage</p>
                    <Link to="/admin" onClick={() => setIsProfileOpen(false)} className={styles.dropdownItem}>
                      <SlidersHorizontal className={styles.dropdownIcon} aria-hidden="true" />
                      Manage templates
                    </Link>
                  </div>

                  <button
                    onClick={() => { setIsProfileOpen(false); handleLogout() }}
                    className={`${styles.dropdownItem} ${styles.logoutItem}`}
                  >
                    <LogOut className={styles.dropdownIcon} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
