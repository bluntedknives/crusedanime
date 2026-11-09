/*
 * Service worker.
 *
 * Goal: the app shell keeps working with no network, and installed launches
 * feel instant. It is deliberately hand-written and build-free — there is no
 * hashed-asset manifest to read, so hashed `/_next/static` files are handled by
 * runtime caching rather than precaching. They are content-addressed, so
 * cache-first is always correct for them.
 *
 * What is cached:
 *   - shell     the offline page + icons + manifest, precached on install
 *   - static    /_next/static/*, fonts, css, js  (cache-first, immutable)
 *   - pages     navigations                       (network-first, cache fallback)
 *   - images    poster/trailer art                (cache-first, size-capped)
 *   - api       same-origin GET /api/*            (network-first, cache fallback)
 *
 * What is NEVER touched:
 *   - anything that is not a GET
 *   - any request carrying a Range header (media seeking)
 *   - /api/stream, /api/proxy, /api/hls — live resolution and HLS segments.
 *     Caching these would either serve a dead URL or, worse, a partial segment.
 */

const VERSION = 'v1'
const SHELL_CACHE = `crused-shell-${VERSION}`
const STATIC_CACHE = `crused-static-${VERSION}`
const PAGE_CACHE = `crused-pages-${VERSION}`
const IMAGE_CACHE = `crused-images-${VERSION}`
const API_CACHE = `crused-api-${VERSION}`
const RUNTIME_CACHES = [STATIC_CACHE, PAGE_CACHE, IMAGE_CACHE, API_CACHE]
const ALL_CACHES = [SHELL_CACHE, ...RUNTIME_CACHES]

const OFFLINE_URL = '/offline'

/** Per-cache entry caps, so a long-lived install cannot grow without bound. */
const LIMITS = {
  [STATIC_CACHE]: 200,
  [PAGE_CACHE]: 60,
  [IMAGE_CACHE]: 80,
  [API_CACHE]: 50,
}

/** Precached on install. Kept small and network-independent. */
const SHELL_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
]

/** Live media and stream resolution: always straight to the network. */
const BYPASS = [/^\/api\/stream\b/, /^\/api\/proxy\b/, /^\/api\/hls\b/]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      // addAll rejects the whole install if one URL 404s; add individually so a
      // single miss cannot leave the worker permanently uninstalled.
      await Promise.all(
        SHELL_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k)))
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.disable()
      }
      await self.clients.claim()
    })(),
  )
})

/** Trim a cache to `limit` entries, oldest-inserted first (Map preserves order). */
async function trimCache(name, limit) {
  if (!limit) return
  const cache = await caches.open(name)
  const keys = await cache.keys()
  if (keys.length <= limit) return
  await Promise.all(keys.slice(0, keys.length - limit).map((k) => cache.delete(k)))
}

/** Cache-first: serve the cached copy, refresh in the background. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then(async (res) => {
      if (res && res.ok) {
        await cache.put(request, res.clone())
        await trimCache(cacheName, LIMITS[cacheName])
      }
      return res
    })
    .catch(() => null)
  return cached || (await network) || Response.error()
}

/** Network-first with a cache fallback: fresh when online, usable when not. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    if (res && res.ok) {
      await cache.put(request, res.clone())
      await trimCache(cacheName, LIMITS[cacheName])
    }
    return res
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    throw new Error('offline')
  }
}

/** Cache-first for immutable, content-addressed assets. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res && res.ok) {
    await cache.put(request, res.clone())
    await trimCache(cacheName, LIMITS[cacheName])
  }
  return res
}

async function handleNavigation(request) {
  const cache = await caches.open(PAGE_CACHE)
  try {
    const res = await fetch(request)
    // Only cache the final, successful, same-origin document.
    if (res && res.ok && res.type === 'basic') {
      await cache.put(request, res.clone())
      await trimCache(PAGE_CACHE, LIMITS[PAGE_CACHE])
    }
    return res
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    const shell = await caches.open(SHELL_CACHE)
    const offline = await shell.match(OFFLINE_URL)
    return (
      offline ||
      new Response('<h1>Offline</h1>', {
        status: 503,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    )
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const sameOrigin = url.origin === self.location.origin

  // Seeking and media fetch send Range; never let the cache answer those.
  if (request.headers.has('range')) return

  if (sameOrigin && BYPASS.some((re) => re.test(url.pathname))) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  if (!sameOrigin) {
    // Remote poster/trailer art only. Everything else (e.g. YouTube embeds)
    // passes straight through.
    if (request.destination === 'image') {
      event.respondWith(cacheFirst(request, IMAGE_CACHE))
    }
    return
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
    return
  }

  if (request.destination === 'style' || request.destination === 'script' || request.destination === 'font') {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
    return
  }

  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE))
    return
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE).catch(() => Response.error()))
    return
  }
})

/** The page asks a waiting worker to take over, then reloads. */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
