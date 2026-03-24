import { Link, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import ThemeToggle from './ThemeToggle'
import { ShoppingBasket, LogOut, Settings, User, ChevronDown } from 'lucide-react'
import SyncIndicator from './SyncIndicator'
import { logoutServerFn } from '../services/auth.api'
import { Route as rootRoute } from '../routes/__root'
import { useState, useRef, useEffect } from 'react'
import styles from './Header.module.css'
import utils from '../styles/utils.module.css'

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
      <nav className={`${utils.flex} ${utils.itemsCenter} ${utils.justifyBetween} ${utils.py3} ${utils.smPy4} page-wrap`}>
        <h1 className={`${utils.m0} ${utils.textSm} ${utils.fontSemibold} ${utils.trackingTight}`}>
          <Link
            to="/"
            className={styles.logoLink}
          >
            <ShoppingBasket className={`${utils.h5} ${utils.w5}`} style={{ color: '#ff9a9e' }} />
            <span className={styles.logoText}>
              Eggspedition
            </span>
          </Link>
        </h1>

        <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2} ${utils.smGap4}`}>
          <SyncIndicator session={session} />
          <ThemeToggle />
          
          {session ? (
            <div className={utils.relative} ref={dropdownRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`${styles.userButton} ${isProfileOpen ? styles.userButtonActive : styles.userButtonInactive}`}
              >
                <div className={styles.userAvatar}>
                  <User className={`${utils.h5} ${utils.w5}`} />
                </div>
                <ChevronDown className={`${utils.h4} ${utils.w4} ${utils.transitionTransform} ${utils.duration300} ${isProfileOpen ? utils.rotate180 : ''}`} style={{ color: 'var(--sea-ink-soft)' }} />
              </button>

              {isProfileOpen && (
                <div className={`${styles.dropdown} ${utils.animateIn}`}>
                  <div className={`${utils.px4} ${utils.py3} ${utils.mb1}`} style={{ borderBottom: '1px solid var(--line)' }}>
                    <p className={`${utils.m0} ${utils.textXs} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWidest} ${utils.opacity60}`} style={{ color: 'var(--sea-ink-soft)' }}>Account</p>
                    <p className={`${utils.m0} ${utils.mt1} ${utils.truncate} ${utils.textSm} ${utils.fontBold}`} style={{ color: 'var(--sea-ink)' }}>{session.email}</p>
                    {session.householdId && (
                      <p className={`${utils.m0} ${utils.mt0_5} ${utils.truncate} ${utils.text10px} ${utils.fontMedium}`} style={{ color: 'var(--sea-ink-soft)' }}>
                        ID: {session.householdId}
                      </p>
                    )}
                  </div>
                  
                  <Link
                    to="/admin"
                    onClick={() => setIsProfileOpen(false)}
                    className={styles.dropdownItem}
                  >
                    <Settings className={`${utils.h4} ${utils.w4}`} />
                    Manage Household
                  </Link>

                  <button
                    onClick={() => {
                      setIsProfileOpen(false)
                      handleLogout()
                    }}
                    className={`${styles.dropdownItem} ${styles.logoutItem}`}
                  >
                    <LogOut className={`${utils.h4} ${utils.w4}`} />
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
