// Eggspedition Service Worker — cache-first for static assets, network-first for pages
const CACHE_NAME = 'eggspedition-v1'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
  '/favicon-16.png',
  '/favicon.ico',
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

// Fetch: cache-first for static assets, network-first for pages
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only handle GET requests from our own origin
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
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
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful page responses
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => {
          // Try to serve from cache, fall back to the root
          return caches.match(event.request).then((cached) => {
            return cached || caches.match('/')
          })
        })
    )
    return
  }

  // Everything else: network-first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
