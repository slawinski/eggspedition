import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  Outlet,
  useNavigate,
  useRouter,
  redirect,
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
import NotFound from '../components/ui/NotFound'
import RouteError from '../components/ui/RouteError'
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

// Splash overlay — inlined in the SSR document so it paints before the
// stylesheet loads. Composition mirrors the iOS launch image (public/splash-*.png)
// for a seamless handoff: static launch screen → breathing egg → app.
const SPLASH_CSS = `
#app-splash {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(1100px 620px at -8% -10%, rgba(79, 184, 178, 0.36), transparent 58%),
    radial-gradient(1050px 620px at 112% -12%, rgba(47, 106, 74, 0.2), transparent 62%),
    radial-gradient(720px 380px at 50% 115%, rgba(79, 184, 178, 0.1), transparent 68%),
    linear-gradient(180deg, #e7f0e8 0%, #f3faf5 44%, #e7f3ec 100%);
  transition: opacity 0.3s ease;
}
#app-splash.app-splash-exit {
  opacity: 0;
  pointer-events: none;
}
#app-splash .app-splash-egg {
  width: clamp(120px, 34vw, 220px);
  height: auto;
  filter: drop-shadow(0 18px 32px rgba(30, 90, 72, 0.16));
  animation:
    app-splash-egg-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both,
    app-splash-egg-breathe 2.8s ease-in-out 0.6s infinite alternate;
}
@keyframes app-splash-egg-in {
  0%   { opacity: 0; transform: scale(0.88); }
  60%  { opacity: 1; transform: scale(1.06); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes app-splash-egg-breathe {
  from { transform: scale(1); }
  to   { transform: scale(1.04); }
}
@media (prefers-reduced-motion: reduce) {
  #app-splash { transition: none; }
  #app-splash .app-splash-egg { animation: none; }
}
`

// Failsafe: hide the splash if React never mounts (e.g. a JS error).
// Only toggles display — React can still unmount the node safely.
const SPLASH_FAILSAFE_SCRIPT = `(function(){var el=document.getElementById('app-splash');if(el){setTimeout(function(){el.style.display='none'},4000)}})()`

const rootSearchSchema = z.object({
  add: z.literal('item').optional().catch(undefined),
  name: z.string().optional().catch(undefined),
  quantity: z.string().optional().catch(undefined),
  category: z.string().optional().catch(undefined),
  store: z.string().optional().catch(undefined),
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  session: Session | null
}>()({
  beforeLoad: async (opts) => {
    const session = await getSessionServerFn()

    // Authenticated users without a household must complete onboarding first
    const pathname = opts.location?.pathname ?? ''
    const publicPaths = ['/login', '/about']
    const isPublicPath = publicPaths.includes(pathname)
    const isOnboardingPath = pathname.startsWith('/onboarding')
    const isJoinPath = pathname.startsWith('/join')
    const isVerifyPath = pathname.startsWith('/api/auth')

    if (
      session &&
      !session.householdId &&
      !isPublicPath &&
      !isOnboardingPath &&
      !isJoinPath &&
      !isVerifyPath
    ) {
      throw redirect({ to: '/onboarding/household' })
    }

    return { session }
  },
  validateSearch: (search) => rootSearchSchema.parse(search) as z.infer<typeof rootSearchSchema>,
  notFoundComponent: () => {
    const { session } = Route.useRouteContext()
    return <NotFound isLoggedIn={!!session} />
  },
  errorComponent: ({ error, reset }) => (
    <RouteError error={error} reset={reset} />
  ),
  head: () => ({
    // NOTE: The root <title> provides a sensible default. Individual routes
    // should set their own title (and optionally other head metadata) via the
    // `head` export on each file route for more specific page titles.
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
      // iOS standalone launch screens (portrait iPhone sizes)
      {
        rel: 'apple-touch-startup-image',
        media: 'screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
        href: '/splash-640x1136.png',
      },
      {
        rel: 'apple-touch-startup-image',
        media: 'screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
        href: '/splash-750x1334.png',
      },
      {
        rel: 'apple-touch-startup-image',
        media: 'screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)',
        href: '/splash-828x1792.png',
      },
      {
        rel: 'apple-touch-startup-image',
        media: 'screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
        href: '/splash-1125x2436.png',
      },
      {
        rel: 'apple-touch-startup-image',
        media: 'screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
        href: '/splash-1170x2532.png',
      },
      {
        rel: 'apple-touch-startup-image',
        media: 'screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)',
        href: '/splash-1179x2556.png',
      },
      {
        rel: 'apple-touch-startup-image',
        media: 'screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)',
        href: '/splash-1242x2688.png',
      },
      {
        rel: 'apple-touch-startup-image',
        media: 'screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)',
        href: '/splash-1284x2778.png',
      },
      {
        rel: 'apple-touch-startup-image',
        media: 'screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)',
        href: '/splash-1290x2796.png',
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const { session } = Route.useRouteContext()
  const search = Route.useSearch() as z.infer<typeof rootSearchSchema>
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
          const { add: _add, ...rest } = previous as z.infer<typeof rootSearchSchema>
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
  const [splashExiting, setSplashExiting] = useState(false)
  const [splashRemoved, setSplashRemoved] = useState(false)

  useEffect(() => {
    // Update theme-color meta after hydration (avoids SSR mismatch)
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const mode = (stored === 'light' || stored === 'dark' || stored === 'auto') ? stored : 'auto'
    const resolved = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#111118' : '#e7f3ec')

    // Let the splash breathe briefly, then fade it out and unmount it
    const exitTimer = window.setTimeout(() => setSplashExiting(true), 350)
    const removeTimer = window.setTimeout(() => setSplashRemoved(true), 700)
    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(removeTimer)
    }
  }, [])

  return (
    <html lang="en" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SW_REGISTER_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
        <HeadContent />
      </head>
      <body className={styles.body} suppressHydrationWarning>
        {!splashRemoved && (
          <div
            id="app-splash"
            aria-hidden="true"
            className={splashExiting ? 'app-splash-exit' : undefined}
          >
            <svg
              className="app-splash-egg"
              viewBox="0 0 512 512"
              xmlns="http://www.w3.org/2000/svg"
              focusable="false"
            >
              <path
                d="
                  M 256 107
                  C 190 107, 136 180, 136 260
                  C 136 340, 188 405, 256 405
                  C 324 405, 376 340, 376 260
                  C 376 180, 322 107, 256 107
                  Z
                "
                fill="#ffffff"
              />
              <ellipse cx="215" cy="210" rx="42" ry="55" fill="rgba(255,255,255,0.3)" />
            </svg>
            <script dangerouslySetInnerHTML={{ __html: SPLASH_FAILSAFE_SCRIPT }} />
          </div>
        )}
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
        // The ToastViewport container sets pointer-events: none so the empty
        // area doesn't block the page — the toast must re-enable its own.
        pointerEvents: 'auto',
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
  // Never render devtools in production builds
  if (!import.meta.env.DEV) return null

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
