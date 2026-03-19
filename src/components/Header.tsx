import { Link, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import ThemeToggle from './ThemeToggle'
import { ShoppingBasket, LogOut } from 'lucide-react'
import SyncIndicator from './SyncIndicator'
import { logoutServerFn } from '../services/auth.api'
import { Route as rootRoute } from '../routes/__root'

export default function Header() {
  const { session } = rootRoute.useRouteContext()
  const router = useRouter()
  const queryClient = useQueryClient()

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

        <div className="flex items-center gap-4">
          <SyncIndicator session={session} />
          <ThemeToggle />
          {session ? (
            <div className="flex items-center gap-3">
              <span className="hidden md:inline text-xs text-[var(--sea-ink-soft)] font-medium">
                {session.email}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--link-bg-hover)] px-3 py-1.5 text-xs font-bold text-[var(--sea-ink-soft)] hover:text-[#ff9a9e] transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-sm font-semibold text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
            >
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
