import { Link, useRouter } from '@tanstack/react-router'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import ThemeToggle from './ThemeToggle'
import { ShoppingBasket, LogOut, User, ChevronDown, Settings, Share2, UserPlus, Check, LogIn } from 'lucide-react'
import SyncIndicator from './SyncIndicator'
import { logoutServerFn } from '../services/auth.api'
import { joinHouseholdFn } from '../services/grocery.api'
import { Route as rootRoute } from '../routes/__root'
import { useState, useRef, useEffect } from 'react'
import styles from './Header.module.css'
import clay from '../styles/clay.module.css'

export default function Header() {
  const { session } = rootRoute.useRouteContext()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [joinId, setJoinId] = useState('')
  const [copied, setCopied] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
        setShowJoin(false)
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

  const joinMutation = useMutation({
    mutationFn: (id: string) => joinHouseholdFn({ data: id }),
    onSuccess: () => {
      setJoinId('')
      setShowJoin(false)
      setIsProfileOpen(false)
      queryClient.invalidateQueries()
      router.invalidate()
      window.location.reload()
    },
  })

  const handleCopy = () => {
    if (!session?.householdId) return
    navigator.clipboard.writeText(session.householdId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
                  </div>
                  
                  {session.householdId && (
                    <>
                      <div className={styles.dropdownSection}>
                        <p className={styles.sectionLabel}>Household</p>
                        <div className={styles.householdActions}>
                          <button
                            onClick={handleCopy}
                            className={styles.householdActionBtn}
                          >
                            {copied ? <Check className={styles.householdActionIcon} /> : <Share2 className={styles.householdActionIcon} />}
                            <span>{copied ? 'Copied!' : 'Share ID'}</span>
                          </button>
                          <span className={styles.householdIdChip}>{session.householdId}</span>
                        </div>
                        <button
                          onClick={() => setShowJoin(!showJoin)}
                          className={styles.householdActionBtn}
                        >
                          <UserPlus className={styles.householdActionIcon} />
                          <span>{showJoin ? 'Cancel' : 'Join Household'}</span>
                        </button>
                      </div>

                      {showJoin && (
                        <div className={styles.joinForm}>
                          <input
                            type="text"
                            value={joinId}
                            onChange={(e) => setJoinId(e.target.value)}
                            placeholder="Paste Household ID..."
                            className={`${clay.input} ${styles.joinInput}`}
                          />
                          <button
                            onClick={() => joinMutation.mutate(joinId)}
                            disabled={joinMutation.isPending || !joinId.trim()}
                            className={`${clay.button} ${styles.joinSubmit}`}
                          >
                            <LogIn className={styles.householdActionIcon} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className={styles.dropdownDivider} />
                  
                  <Link
                    to="/admin"
                    onClick={() => setIsProfileOpen(false)}
                    className={styles.dropdownItem}
                  >
                    <Settings className={styles.dropdownIcon} />
                    Admin
                  </Link>
                  
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
