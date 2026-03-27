import { Link, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import ThemeToggle from './ThemeToggle'
import { ShoppingBasket, LogOut, Settings, User, ChevronDown } from 'lucide-react'
import SyncIndicator from './SyncIndicator'
import { logoutServerFn } from '../services/auth.api'
import { Route as rootRoute } from '../routes/__root'
import { useState, useRef, useEffect } from 'react'
import styles from './Header.module.css'

export default function Header() {
  const { session } = rootRoute.useRouteContext()
  const router = useRouter()
  const queryClient = useQueryClient()
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
    localStorage.clear()
    router.invalidate()
  }

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <h1 className={styles.title}>
          <Link
            to="/"
            className={styles.logoLink}
          >
            <ShoppingBasket className={styles.logoIcon} />
            <span className={styles.logoText}>
              Eggspedition
            </span>
          </Link>
        </h1>

        <div className={styles.actions}>
          <SyncIndicator />
          <ThemeToggle />
          
          {session ? (
            <div className={styles.userMenu} ref={dropdownRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`${styles.userButton} ${isProfileOpen ? styles.userButtonActive : styles.userButtonInactive}`}
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
                    {session.householdId && (
                      <p className={styles.accountID}>
                        ID: {session.householdId}
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => {
                      setIsProfileOpen(false)
                      handleLogout()
                    }}
                    className={`${styles.dropdownItem} ${styles.logoutItem}`}
                  >
                    <LogOut className={styles.dropdownIcon} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className={styles.loginLink}
            >
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
