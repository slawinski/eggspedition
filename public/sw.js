// Eggspedition Service Worker — cache-first for static assets, network-first for pages
const CACHE_NAME = 'eggspedition-v3'
let navigationEpoch = 0
let navigationWrites = Promise.resolve()
const authPath = (path) => /^\/(login(?:\/|$)|api\/auth(?:\/|$)|_serverFn(?:\/|$))/.test(path)
const offlineSignIn = () => new Response('Sign-in needs an internet connection. Reconnect, then open this app again to sign in. You do not need to reinstall.', {
  status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
})
const STATIC_ASSETS = [
  '/manifest.json',

  '/favicon.svg',
  '/favicon-16.png',
  '/favicon-32.png',
  '/favicon-48.png',
  '/favicon.ico',

  '/apple-touch-icon-v2.png',

  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/pwa-maskable-192.png',
  '/pwa-maskable-512.png',

  '/robots.txt',
]

// Install: precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to precache some assets:', err)
      })
    })
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'clear-auth-navigations') return
  // Increment synchronously, before any pending network response can queue a write.
  navigationEpoch++
  navigationWrites = navigationWrites.then(async () => {
    const cache = await caches.open(CACHE_NAME)
    const keys = await cache.keys()
    await Promise.all(keys.map(async (request) => {
      const response = await cache.match(request)
      if (response?.headers.get('Content-Type')?.includes('text/html') || new URL(request.url).pathname === '/' || authPath(new URL(request.url).pathname)) {
        await cache.delete(request)
      }
    }))
  })
  event.waitUntil(navigationWrites.then(() => {
    event.ports[0]?.postMessage({ type: 'auth-navigations-cleared' })
  }, () => {
    event.ports[0]?.postMessage({ type: 'auth-navigation-clear-failed' })
  }))
})

// Fetch: cache-first for static assets, network-first for pages
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only handle GET requests from our own origin
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return
  }

  // All server-function GETs (including session reads) are network-only.
  // Auth pages must never fall back to a previously authenticated root document.
  if (authPath(url.pathname)) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => offlineSignIn()))
    return
  }

  // Static assets (js, css, fonts, images, icons): cache-first
  if (/\.(js|css|woff2?|png|svg|ico|jpg|webp|avif)$/.test(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Navigation / page requests: network-first with offline fallback
  if (event.request.mode === 'navigate') {
    const epoch = navigationEpoch
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          // Cache successful page responses
          if (response.ok && (!response.url || !authPath(new URL(response.url).pathname))) {
            const clone = response.clone()
            navigationWrites = navigationWrites.then(async () => {
              if (epoch !== navigationEpoch) return
              const cache = await caches.open(CACHE_NAME)
              // The open itself can yield to a logout message.
              if (epoch === navigationEpoch) await cache.put(event.request, clone)
            })
            event.waitUntil(navigationWrites)
          }
          return response
        })
        .catch(() => {
          // Try to serve from cache, fall back to the root
          return caches.match(event.request).then((cached) => {
            return cached || caches.match('/').then((r) => r || offlineSignIn())
          })
        })
    )
    return
  }

  // Everything else: network-first
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached || new Response('Network error', { status: 408 }))
    )
  )
})
