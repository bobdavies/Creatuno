// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Creatuno Service Worker
// Handles: caching strategies, background sync, push notifications
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STATIC_CACHE = 'creatuno-static-v2'
const API_CACHE = 'creatuno-api-v2'

// ── Static assets to precache on install ─────────────────────────────────────

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
]

// ── Route classification helpers ─────────────────────────────────────────────

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.css')
  )
}

// Public/slow-changing APIs → stale-while-revalidate
const STALE_REVALIDATE_PATHS = [
  '/api/portfolios/public',
  '/api/stats',
  '/api/mentors',
]

function isStaleRevalidateAPI(url) {
  return STALE_REVALIDATE_PATHS.some((p) => url.pathname.startsWith(p))
}

// Dynamic user APIs → network-first with cache fallback
const NETWORK_FIRST_PATHS = [
  '/api/profiles',
  '/api/posts',
  '/api/notifications',
  '/api/messages',
  '/api/mentorship',
  '/api/opportunities',
  '/api/applications',
  '/api/search',
  '/api/stats/user',
]

function isNetworkFirstAPI(url) {
  return NETWORK_FIRST_PATHS.some((p) => url.pathname.startsWith(p))
}

// ── Install: precache static assets ──────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('Precache failed for some URLs:', err)
      })
    })
  )
  self.skipWaiting()
})

// ── Activate: clean old caches ───────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// ── Fetch: apply caching strategies ──────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only handle GET requests for caching
  if (event.request.method !== 'GET') return

  // Skip non-http(s) and chrome-extension requests
  if (!url.protocol.startsWith('http')) return

  // 1) Static assets → cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE))
    return
  }

  // 2) Public/slow-changing APIs → stale-while-revalidate
  if (isStaleRevalidateAPI(url)) {
    event.respondWith(staleWhileRevalidate(event.request, API_CACHE))
    return
  }

  // 3) Dynamic user APIs → network-first with cache fallback
  if (isNetworkFirstAPI(url)) {
    event.respondWith(networkFirst(event.request, API_CACHE))
    return
  }

  // 4) HTML pages → network-first (so we get latest SSR content, but cache for offline)
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(event.request, STATIC_CACHE))
    return
  }
})

// ── Caching strategy: Cache First ────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Return a basic offline fallback for assets
    return new Response('', { status: 503, statusText: 'Offline' })
  }
}

// ── Caching strategy: Stale While Revalidate ─────────────────────────────────

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  // Fire off network fetch in background to update cache
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  // Return cached immediately if available, otherwise wait for network
  if (cached) {
    // Don't await networkPromise — let it update in background
    networkPromise.catch(() => {})
    return cached
  }

  // No cache — must wait for network
  const networkResponse = await networkPromise
  if (networkResponse) return networkResponse

  return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── Caching strategy: Network First ──────────────────────────────────────────

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Network failed — try cache
    const cached = await caches.match(request)
    if (cached) return cached

    // Nothing in cache either — return appropriate fallback
    const isPageRequest = request.headers.get('accept')?.includes('text/html')
    if (isPageRequest) {
      return new Response(offlineFallbackHTML(), {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// ── Offline HTML fallback for page navigations ──────────────────────────────

function offlineFallbackHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Offline — Creatuno</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #1B0F28; color: #FBFCFE;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 1.5rem; text-align: center;
    }
    .container { max-width: 420px; }
    .icon {
      width: 64px; height: 64px; margin: 0 auto 1.5rem;
      border-radius: 16px;
      background: linear-gradient(135deg, rgba(254,199,20,0.2), rgba(126,93,167,0.1));
      display: flex; align-items: center; justify-content: center;
    }
    .icon svg { width: 32px; height: 32px; color: #FEC714; }
    .brand { font-size: 1.25rem; font-weight: 700; color: #FEC714; margin-bottom: 0.5rem; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
    p { font-size: 0.875rem; color: #A098AE; line-height: 1.6; margin-bottom: 1.5rem; }
    .btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.75rem 1.5rem; border-radius: 9999px; border: none;
      background: #FEC714; color: #1B0F28; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: background 0.2s;
    }
    .btn:hover { background: #E1A504; }
    .home-link {
      display: block; margin-top: 1rem; font-size: 0.75rem;
      color: #71717a; text-decoration: none;
    }
    .home-link:hover { color: #FEC714; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    </div>
    <div class="brand">Creatuno</div>
    <h1>You&rsquo;re offline</h1>
    <p>It looks like you&rsquo;ve lost your internet connection. Check your network and try again.</p>
    <button class="btn" onclick="location.reload()">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
      Try Again
    </button>
    <a class="home-link" href="/">Back to homepage</a>
  </div>
</body>
</html>`
}

// ── Background Sync ──────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'creatuno-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

async function doBackgroundSync() {
  try {
    const db = await openDatabase()
    const pendingItems = await getPendingSyncItems(db)

    for (const item of pendingItems) {
      try {
        await syncItem(item)
        await markItemSynced(db, item.id)
      } catch (error) {
        console.error('Failed to sync item:', item.id, error)
      }
    }

    // Notify all open windows
    const clients = await self.clients.matchAll()
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        timestamp: Date.now(),
      })
    })
  } catch (error) {
    console.error('Background sync failed:', error)
    throw error // Causes sync to be retried
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('creatuno-offline', 2)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

function getPendingSyncItems(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readonly')
    const store = tx.objectStore('syncQueue')
    const index = store.index('by-status')
    const request = index.getAll('pending')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

async function syncItem(item) {
  const response = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  })

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`)
  }

  return response.json()
}

function markItemSynced(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readwrite')
    const store = tx.objectStore('syncQueue')
    const request = store.delete(id)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// ── Message handling ─────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data?.type === 'TRIGGER_SYNC') {
    if (navigator.onLine && self.registration.sync) {
      self.registration.sync
        .register('creatuno-sync')
        .then(() => console.log('Sync registered'))
        .catch((err) => console.error('Sync registration failed:', err))
    }
  }
})

// ── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.svg',
      badge: '/icons/icon-72x72.svg',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' },
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen)
        }
      })
  )
})
