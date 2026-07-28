import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  Outlet,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import type { Session } from '../lib/schemas'
import { getSessionServerFn } from '../services/auth.api'
import Header from '../components/Header'
import MobileNav from '../components/MobileNav'
import Signals from '../components/Signals'
import AddItemSheet from '../components/AddItemSheet'
import styles from './__root.module.css'
import { useEffect, useState, useRef } from 'react'
import { z } from 'zod'
import { UndoProvider } from '../hooks/useUndo'
import ToastViewport from '../components/ui/ToastViewport'
import OfflineBanner from '../components/ui/OfflineBanner'
import { useUndoToast } from '../hooks/useUndoToast'

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(e){var stored=window.localStorage.getItem('theme');if(!stored||stored==='auto'){var r=e.matches?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',r==='dark'?'#111118':'#e7f3ec')}});window.addEventListener('storage',function(e){if(e.key==='theme'){document.querySelector('meta[name="theme-color"]')?.setAttribute('content',e.newValue==='dark'?'#111118':'#e7f3ec')}})}catch(e){}})();`

const SW_REGISTER_SCRIPT = `(function(){var isDev=window.location.hostname.includes('localhost')||window.location.hostname.includes('127.0.0.1');if(isDev){navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){r.unregister()})});return}if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(e){console.warn('SW registration failed:',e)})}})()`

const rootSearchSchema = z
  .object({
    add: z.literal('item').optional().catch(undefined),
    name: z.string().optional().catch(undefined),
    quantity: z.string().optional().catch(undefined),
    category: z.string().optional().catch(undefined),
    store: z.string().optional().catch(undefined),
  })
  .passthrough()

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  session: Session | null
}>()({
  beforeLoad: async () => {
    const session = await getSessionServerFn()
    return { session }
  },
  validateSearch: (search) => rootSearchSchema.parse(search),
  notFoundComponent: () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--sea-ink)' }}>404</h1>
      <p style={{ color: 'var(--sea-ink-soft)', fontSize: '1rem' }}>This page doesn't exist or has been moved.</p>
      <a href="/" style={{ color: 'var(--lagoon-deep)', fontWeight: 600 }}>Back to home</a>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>Something went wrong</h1>
      <p style={{ color: 'var(--sea-ink-soft)', fontSize: '0.9375rem', maxWidth: 480 }}>{error?.message || 'An unexpected error occurred.'}</p>
      <a href="/" style={{ color: 'var(--lagoon-deep)', fontWeight: 600 }}>Back to home</a>
    </div>
  ),
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content',
      },
      {
        name: 'description',
        content: 'Keep your household grocery list in sync. Add items quickly, organise them by category or store, and shop from the same list on every phone.',
      },
      {
        name: 'theme-color',
        content: '#e7f3ec',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'default',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'Eggspedition',
      },
      {
        property: 'og:title',
        content: 'Eggspedition — A shared grocery list for your household',
      },
      {
        property: 'og:description',
        content: 'Keep your household grocery list in sync. Add items quickly, organise them by category or store, and shop from the same list on every phone.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:image',
        content: '/og-eggspedition.png',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        title: 'Eggspedition — A shared grocery list for your household',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16.png',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon-v2.png',
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const { session } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()
  const fabRef = useRef<HTMLButtonElement>(null)

  const isAddItemSheetOpen = search.add === 'item'

  const currentPathname = router.state.location.pathname

  const openAddItemSheet = () => {
    navigate({
      to: currentPathname,
      search: (previous) => ({
        ...previous,
        add: 'item' as const,
      }),
      state: (previous) => ({
        ...previous,
        addItemSheetOpenedInApp: true,
      }),
    })
  }

  const closeAddItemSheet = () => {
    // If the sheet was opened in-app (there's a history entry before it),
    // use browser Back. Otherwise, replace the search param.
    const locationState = router.state.location
      .state as unknown as Record<string, unknown> | undefined
    const wasOpenedInApp =
      locationState?.addItemSheetOpenedInApp === true

    if (wasOpenedInApp && window.history.length > 1) {
      router.history.back()
    } else {
      navigate({
        to: currentPathname,
        replace: true,
        search: (previous) => {
          const { add: _add, ...rest } = previous
          return rest
        },
      })
    }
  }

  return (
    <div className={styles.layout}>
      {session && <Signals />}
      <OfflineBanner />
      <Header />
      {session ? (
        <UndoProvider householdId={session.householdId}>
          <div className={styles.main}>
            <Outlet />
          </div>
          <ToastViewport>
            <UndoToastRenderer />
          </ToastViewport>
        </UndoProvider>
      ) : (
        <div className={styles.main}>
          <Outlet />
        </div>
      )}
      {session && (
        <MobileNav
          fabRef={fabRef}
          isAddItemSheetOpen={isAddItemSheetOpen}
          onAddClick={openAddItemSheet}
        />
      )}
      {session && (
        <AddItemSheet
          isOpen={isAddItemSheetOpen}
          onClose={closeAddItemSheet}
          triggerRef={fabRef}
          initialName={search.name}
          initialQuantity={search.quantity}
          initialCategory={search.category}
          initialStore={search.store}
        />
      )}
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Update theme-color meta after hydration (avoids SSR mismatch)
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const mode = (stored === 'light' || stored === 'dark' || stored === 'auto') ? stored : 'auto'
    const resolved = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#111118' : '#e7f3ec')
  }, [])

  return (
    <html lang="en" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SW_REGISTER_SCRIPT }} />
        <HeadContent />
      </head>
      <body className={styles.body} suppressHydrationWarning>
        <a href="#main-content" className="skip-link">Skip to content</a>
        {children}
        <Devtools />
        <Scripts />
      </body>
    </html>
  )
}

function UndoToastRenderer() {
  const toast = useUndoToast()

  if (!toast.visible) return null

  return (
    <div
      role={toast.role}
      aria-live={toast.role === 'status' ? 'polite' : 'assertive'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        background: 'var(--surface-card)',
        borderRadius: '1rem',
        boxShadow: '0 4px 24px var(--shadow-color)',
        fontSize: '0.875rem',
        fontWeight: 600,
        color: 'var(--sea-ink)',
        border: '1px solid var(--line)',
      }}
    >
      <span>{toast.message}</span>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        {!toast.isUndone && (
          <button
            onClick={toast.onUndo}
            style={{
              padding: '0.375rem 0.875rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: 'var(--accent-lavender)',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            Undo
          </button>
        )}
        <button
          onClick={toast.onDismiss}
          aria-label="Dismiss"
          style={{
            padding: '0.375rem 0.875rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--sea-ink-soft)',
            fontWeight: 700,
            fontSize: '0.8125rem',
            cursor: 'pointer',
          }}
        >
          {toast.isUndone ? 'OK' : '✕'}
        </button>
      </div>
    </div>
  )
}

function Devtools() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return (
    <TanStackDevtools
      config={{ position: 'bottom-right' }}
      plugins={[
        {
          name: 'Tanstack Router',
          render: <TanStackRouterDevtoolsPanel />,
        },
      ]}
    />
  )
}
