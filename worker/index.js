// Custom service worker extensions for next-pwa
// Handles: background sync, push notifications, SW messaging

// ── Background Sync ──────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'creatuno-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

async function doBackgroundSync() {
  const MAX_RETRIES = 3
  const RETRY_DELAY_MS = 1000

  try {
    const db = await openSyncDatabase()
    const pendingItems = await getPendingSyncItems(db)

    for (const item of pendingItems) {
      let success = false
      for (let attempt = 0; attempt < MAX_RETRIES && !success; attempt++) {
        try {
          await syncItem(item)
          await markItemSynced(db, item.id)
          success = true
        } catch (error) {
          console.warn(`Sync attempt ${attempt + 1}/${MAX_RETRIES} failed for ${item.id}:`, error)
          if (attempt < MAX_RETRIES - 1) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * Math.pow(2, attempt)))
          }
        }
      }

      if (!success) {
        await markItemFailed(db, item.id, item.retryCount + MAX_RETRIES)
      }
    }

    const clients = await self.clients.matchAll()
    clients.forEach((client) => {
      client.postMessage({ type: 'SYNC_COMPLETE', timestamp: Date.now() })
    })
  } catch (error) {
    console.error('Background sync failed:', error)
    throw error
  }
}

function openSyncDatabase() {
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

function markItemFailed(db, id, retryCount) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('syncQueue', 'readwrite')
    const store = tx.objectStore('syncQueue')
    const getReq = store.get(id)
    getReq.onerror = () => reject(getReq.error)
    getReq.onsuccess = () => {
      const item = getReq.result
      if (item) {
        item.status = 'failed'
        item.retryCount = retryCount
        const putReq = store.put(item)
        putReq.onerror = () => reject(putReq.error)
        putReq.onsuccess = () => resolve()
      } else {
        resolve()
      }
    }
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
        .catch((err) => console.error('Sync registration failed:', err))
    }
  }
})

// ── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json()
      const options = {
        body: data.body,
        icon: '/icons/icon-192x192.svg',
        badge: '/icons/icon-72x72.svg',
        vibrate: [100, 50, 100],
        data: { url: data.url || '/' },
      }
      event.waitUntil(self.registration.showNotification(data.title, options))
    } catch (err) {
      console.error('Push notification parse error:', err)
    }
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
