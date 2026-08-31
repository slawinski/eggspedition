import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import ThemeToggle from './ThemeToggle'
import { ShoppingBasket, LogOut, User, ChevronDown, Settings } from 'lucide-react'
import SyncStatusButton from './ui/SyncStatusButton'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { logoutServerFn } from '../services/auth.api'
import { Route as rootRoute } from '../routes/__root'
import { useState, useRef, useEffect, useCallback } from 'react'
import styles from './Header.module.css'

/** Non-interactive menu items (email display) count as separators in keyboard nav */
const SKIP_KEYBOARD_FOCUS = -1

export default function Header() {
  const { session } = rootRoute.useRouteContext()
  const router = useRouter()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  const queryClient = useQueryClient()
  const { isOnline } = useOnlineStatus()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [focusedItemIndex, setFocusedItemIndex] = useState(-1)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // ── Build interactive menu items for keyboard nav ──
  const getInteractiveItems = useCallback((): HTMLElement[] => {
    if (!menuRef.current) return []
    return Array.from(
      menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]')
    )
  }, [])

  // ── Close on route change ──
  useEffect(() => {
    setIsProfileOpen(false)
  }, [pathname])

  // ── Close on outside click ──
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Focus active menu item on index change ──
  useEffect(() => {
    if (focusedItemIndex >= 0 && isProfileOpen) {
      const items = getInteractiveItems()
      items[focusedItemIndex]?.focus()
    }
  }, [focusedItemIndex, isProfileOpen, getInteractiveItems])

  // ── Reset focus index when menu closes ──
  useEffect(() => {
    if (!isProfileOpen) setFocusedItemIndex(SKIP_KEYBOARD_FOCUS)
  }, [isProfileOpen])

  // ── Keyboard handler (ARIA menu pattern) ──
  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = getInteractiveItems()
    if (items.length === 0) return

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        setIsProfileOpen(false)
        triggerRef.current?.focus()
        break

      case 'ArrowDown':
        e.preventDefault()
        if (!isProfileOpen) {
          setIsProfileOpen(true)
          setFocusedItemIndex(0)
        } else {
          setFocusedItemIndex((prev) => (prev + 1) % items.length)
        }
        break

      case 'ArrowUp':
        e.preventDefault()
        if (isProfileOpen) {
          setFocusedItemIndex(
            (prev) => (prev - 1 + items.length) % items.length
          )
        }
        break

      case 'Home':
        e.preventDefault()
        if (isProfileOpen) setFocusedItemIndex(0)
        break

      case 'End':
        e.preventDefault()
        if (isProfileOpen) setFocusedItemIndex(items.length - 1)
        break

      case 'Tab':
        // Close on Tab-out so focus moves naturally past the menu
        if (isProfileOpen) {
          setIsProfileOpen(false)
        }
        break
    }
  }

  const handleLogout = async () => {
    setIsProfileOpen(false)
    await logoutServerFn()
    queryClient.clear()
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('eggspedition:') || key.startsWith('REACT_QUERY'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k))
    router.invalidate()
  }

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        {session?.householdId ? (
          // Authenticated in-app view: passive household context chip.
          // Navigation lives in the bottom bar, so no link/button here.
          <div className={styles.householdChip} title={session.householdName ?? 'My Household'}>
            <ShoppingBasket className={styles.householdChipIcon} aria-hidden="true" />
            <span className={styles.householdChipName}>
              {session.householdName ?? 'My Household'}
            </span>
          </div>
        ) : (
          <h1>
            <Link to="/" className={styles.logoLink}>
              <ShoppingBasket className={styles.logoIcon} aria-hidden="true" />
              <span className={styles.logoText}>Eggspedition</span>
            </Link>
          </h1>
        )}

        {!session && (
          <div className={styles.publicNav}>
            <a href="#how-it-works" className={styles.publicNavLink}>
              How it works
            </a>
            <a href="#features" className={styles.publicNavLink}>
              Features
            </a>
            <ThemeToggle />
            <Link to="/login" className={styles.publicLoginLink}>
              Log in
            </Link>
            <Link to="/login" className={styles.publicPrimaryLink}>
              Start your list
            </Link>
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
                ref={triggerRef}
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                onKeyDown={handleMenuKeyDown}
                className={`${styles.userButton} ${isProfileOpen ? styles.userButtonActive : ''}`}
                aria-label="Open account menu"
                aria-haspopup="menu"
                aria-expanded={isProfileOpen}
              >
                <div className={styles.userAvatar}>
                  <User className={styles.avatarIcon} aria-hidden="true" />
                </div>
                <ChevronDown
                  className={`${styles.chevronIcon} ${isProfileOpen ? styles.chevronIconRotated : ''}`}
                  aria-hidden="true"
                />
              </button>

              {isProfileOpen && (
                <div
                  className={styles.dropdown}
                  role="menu"
                  ref={menuRef}
                  aria-label="Account menu"
                >
                  {/* Email display (non-interactive) */}
                  <div className={styles.accountInfo}>
                    <p className={styles.accountLabel}>Account</p>
                    <p className={styles.accountEmail}>{session.email}</p>
                  </div>

                  <div className={styles.dropdownSection}>
                    <p className={styles.sectionLabel}>Household</p>
                    {session.householdId ? (
                      <Link
                        to="/settings/household"
                        onClick={() => setIsProfileOpen(false)}
                        className={styles.dropdownItem}
                        role="menuitem"
                        tabIndex={-1}
                      >
                        <Settings className={styles.dropdownIcon} aria-hidden="true" />
                        Household settings
                      </Link>
                    ) : (
                      <span
                        className={styles.dropdownItem}
                        role="menuitem"
                        tabIndex={-1}
                        aria-disabled="true"
                      >
                        <Settings className={styles.dropdownIcon} aria-hidden="true" />
                        No household
                      </span>
                    )}
                  </div>

                  <div className={styles.dropdownDivider} />

                  <div className={styles.dropdownSection}>
                    <p className={styles.sectionLabel}>Manage</p>
                    <Link
                      to="/settings/quick-add"
                      onClick={() => setIsProfileOpen(false)}
                      className={styles.dropdownItem}
                      role="menuitem"
                      tabIndex={-1}
                    >
                      <Settings className={styles.dropdownIcon} aria-hidden="true" />
                      Quick Add templates
                    </Link>
                  </div>

                  <button
                    onClick={handleLogout}
                    className={`${styles.dropdownItem} ${styles.logoutItem}`}
                    role="menuitem"
                    tabIndex={-1}
                  >
                    <LogOut className={styles.dropdownIcon} aria-hidden="true" />
                    Log out
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
