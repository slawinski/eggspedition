import { HeadContent, Scripts, createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import type { Session } from '../lib/schemas'
import { getSessionServerFn } from '../services/auth.api'
import Header from '../components/Header'
import MobileNav from '../components/MobileNav'
import Signals from '../components/Signals'
import styles from './__root.module.css'
import { useEffect, useState } from 'react'

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(e){var stored=window.localStorage.getItem('theme');if(!stored||stored==='auto'){var r=e.matches?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',r==='dark'?'#111118':'#e7f3ec')}});window.addEventListener('storage',function(e){if(e.key==='theme'){document.querySelector('meta[name="theme-color"]')?.setAttribute('content',e.newValue==='dark'?'#111118':'#e7f3ec')}})}catch(e){}})();`

const SW_REGISTER_SCRIPT = `(function(){var isDev=window.location.hostname.includes('localhost')||window.location.hostname.includes('127.0.0.1');if(isDev){navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){r.unregister()})});return}if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(e){console.warn('SW registration failed:',e)})}})()`

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  session: Session | null
}>()({
  beforeLoad: async () => {
    const session = await getSessionServerFn()
    return { session }
  },
  notFoundComponent: () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--sea-ink)' }}>404</h1>
      <p style={{ color: 'var(--sea-ink-soft)', fontSize: '1rem' }}>This page doesn't exist or has been moved.</p>
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
        content: 'Eggspedition — Squishy. Shared. Seamless. The delightful grocery list app for your household.',
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
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'default',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'Eggspedition',
      },
      {
        title: 'Eggspedition - Grocery List',
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
        href: '/icon.svg',
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
        href: '/apple-touch-icon.png',
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const { session } = Route.useRouteContext()

  return (
    <div className={styles.layout}>
      {session && <Signals />}
      <Header />
      <div className={styles.main}>
        <Outlet />
      </div>
      {session && <MobileNav />}
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
        {children}
        <Devtools />
        <Scripts />
      </body>
    </html>
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
