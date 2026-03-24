import { Link, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import ThemeToggle from './ThemeToggle'
import { ShoppingBasket, LogOut, Settings, User, ChevronDown } from 'lucide-react'
import SyncIndicator from './SyncIndicator'
import { logoutServerFn } from '../services/auth.api'
import { Route as rootRoute } from '../routes/__root'
import { useState, useRef, useEffect } from 'react'

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
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
      <nav className="page-wrap flex items-center justify-between py-3 sm:py-4">
        <h1 className="m-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--sea-ink)] no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
          >
            <ShoppingBasket className="h-5 w-5 text-[#ff9a9e]" />
            <span className="bg-gradient-to-r from-[#ff9a9e] to-[#a18cd1] bg-clip-text text-transparent font-bold">
              Eggspedition
            </span>
          </Link>
        </h1>

        <div className="flex items-center gap-2 sm:gap-4">
          <SyncIndicator session={session} />
          <ThemeToggle />
          
          {session ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`flex items-center gap-1 p-1.5 rounded-2xl transition-all active:scale-95 ${isProfileOpen ? 'bg-[var(--line)] shadow-inner' : 'bg-white shadow-clay-sm hover:shadow-clay-md'}`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff9a9e] to-[#fecfef] text-white">
                  <User className="h-5 w-5" />
                </div>
                <ChevronDown className={`h-4 w-4 text-[var(--sea-ink-soft)] transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-3 w-64 origin-top-right rounded-3xl border border-[var(--line)] bg-white p-2 shadow-clay-lg animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-3 border-b border-[var(--line)] mb-1">
                    <p className="m-0 text-xs font-bold uppercase tracking-widest text-[var(--sea-ink-soft)] opacity-60">Account</p>
                    <p className="m-0 mt-1 truncate text-sm font-bold text-[var(--sea-ink)]">{session.email}</p>
                    {session.householdId && (
                      <p className="m-0 mt-0.5 truncate text-[10px] font-medium text-[var(--sea-ink-soft)]">
                        ID: {session.householdId}
                      </p>
                    )}
                  </div>
                  
                  <Link
                    to="/admin"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold text-[var(--sea-ink-soft)] hover:bg-[var(--page-bg)] hover:text-[#a18cd1] transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    Manage Household
                  </Link>

                  <button
                    onClick={() => {
                      setIsProfileOpen(false)
                      handleLogout()
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold text-[var(--sea-ink-soft)] hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#a18cd1] shadow-clay-sm hover:shadow-clay-md transition-all active:scale-95"
            >
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
