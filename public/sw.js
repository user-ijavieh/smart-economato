// ╔══════════════════════════════════════════════════════════════╗
// ║          SmartEconomato Service Worker v2.0.0               ║
// ║     Cache-First (static) + Network-First (API)              ║
// ║     + Background Sync + Smart Cache Management              ║
// ╚══════════════════════════════════════════════════════════════╝

// Build timestamp injected at deploy time — ensures every new build
// creates fresh caches and evicts stale ones automatically.
const BUILD_TIMESTAMP = '__BUILD_TIMESTAMP__'; // replaced by CI/build pipeline (or just bump manually)
const CACHE_VERSION = `v2-${BUILD_TIMESTAMP}`;
const STATIC_CACHE = `smart-economato-static-${CACHE_VERSION}`;
const API_CACHE = `smart-economato-api-${CACHE_VERSION}`;
const SYNC_QUEUE_STORE = 'sync-queue';
const OFFLINE_RESPONSES_STORE = 'offline-responses';

const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
const swLogger = {
  warn: (...args) => {
    if (IS_DEV) console.warn(...args);
  },
  error: (...args) => {
    console.error(...args);
  }
};

// Maximum cache sizes
const MAX_API_CACHE_SIZE = 50; // 50 items max per cache
const MAX_STATIC_CACHE_SIZE = 100;

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/styles.css',
];

// API routes to cache with network-first strategy
const API_CACHE_PATTERNS = [
  /\/api\/products/,
  /\/api\/recipes/,
  /\/api\/allergens/,
  /\/api\/suppliers/,
  /\/api\/orders/,
  /\/api\/stats/,
];

// Routes that should be queued for background sync
const SYNC_ROUTES = [
  /\/api\/orders\/create/,
  /\/api\/products\/update/,
  /\/api\/recipes\/update/,
];

// ─── Install: pre-cache static shell ───────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// ─── Activate: clean up old caches ─────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        const oldCaches = keys.filter(
          (k) => k !== STATIC_CACHE && k !== API_CACHE
        );
        return Promise.all(oldCaches.map((k) => caches.delete(k)));
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// ─── Message Handler: receive SKIP_WAITING ─────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Fetch: routing strategy ────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and browser-extension requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // Skip auth and WebSocket endpoints — always network
  if (url.pathname.includes('/api/auth') || url.pathname.includes('/ws')) return;

  // index.html: ALWAYS Network-First (never cache-only) so deploys propagate immediately
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Update the cached copy so offline works
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
  // API calls: Network-First with cache fallback
  if (API_CACHE_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
    return;
  }

  // Static assets & app shell: Cache-First
  if (
    url.pathname.includes('/assets/') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|webmanifest|woff2?|ttf)$/)
  ) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // Navigation requests (SPA routes): serve index.html from cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html')
      )
    );
    return;
  }
});

// ─── Strategy: Cache-First ──────────────────────────────────────
async function cacheFirstStrategy(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const network = await fetch(request);
    if (network.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, network.clone());
      // Clean up cache if exceeds max size
      pruneCache(cacheName, MAX_STATIC_CACHE_SIZE);
    }
    return network;
  } catch {
    return new Response('Sin conexión', { status: 503 });
  }
}

// ─── Strategy: Network-First ────────────────────────────────────
async function networkFirstStrategy(request, cacheName) {
  try {
    const network = await fetch(request);
    if (network.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, network.clone());
      // Clean up cache if exceeds max size
      pruneCache(cacheName, MAX_API_CACHE_SIZE);
    }
    return network;
  } catch {
    // Queue POST/PUT/DELETE requests for background sync if offline
    if (request.method !== 'GET') {
      await queueRequestForSync(request);
      return new Response(JSON.stringify({ queued: true, offline: true, message: 'Solicitud encolada. Se sincronizará cuando haya conexión.' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Sin conexión', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── Cache Pruning ──────────────────────────────────────────────
async function pruneCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxSize) {
    // Remove oldest entries (simple FIFO)
    const toDelete = keys.slice(0, keys.length - maxSize);
    for (const req of toDelete) {
      cache.delete(req);
    }
  }
}

// ─── Request Queue for Background Sync ───────────────────────────
async function queueRequestForSync(request) {
  try {
    const db = await openDB();
    const queue = await db.getAll(SYNC_QUEUE_STORE);
    
    const queueItem = {
      id: Date.now(),
      method: request.method,
      url: request.url,
      body: await request.clone().text(),
      headers: Object.fromEntries(request.headers),
      timestamp: Date.now(),
    };
    
    queue.push(queueItem);
    await db.put(SYNC_QUEUE_STORE, queueItem);
  } catch (e) {
    swLogger.warn('[SW] Error queueing request:', e);
  }
}

// ─── Simple IndexedDB Helper ─────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('SmartEconomatoDB', 1);
    
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        db.close();
        return reject(new Error('Store not found'));
      }
      resolve({
        getAll: (store) => new Promise((res, rej) => {
          const tx = db.transaction(store, 'readonly');
          const req = tx.objectStore(store).getAll();
          req.onsuccess = () => res(req.result || []);
          req.onerror = () => rej(req.error);
        }),
        put: (store, item) => new Promise((res, rej) => {
          const tx = db.transaction(store, 'readwrite');
          const req = tx.objectStore(store).put(item);
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        }),
        delete: (store, key) => new Promise((res, rej) => {
          const tx = db.transaction(store, 'readwrite');
          const req = tx.objectStore(store).delete(key);
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        }),
        clear: (store) => new Promise((res, rej) => {
          const tx = db.transaction(store, 'readwrite');
          const req = tx.objectStore(store).clear();
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        }),
      });
    };
    
    req.onupgradeneeded = (evt) => {
      const db = evt.target.result;
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
      }
    };
  });
}

// ─── Push Notifications (prepared for future use) ───────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'SmartEconomato', {
      body: data.body || '',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: data.tag || 'economato-notification',
      data: data.url ? { url: data.url } : {},
      badge: '/badge-72x72.png',
      vibrate: [200, 100, 200],
      requireInteraction: data.requireInteraction || false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});

// ─── Background Sync for Queued Requests ────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(syncQueuedRequests());
  }
});

async function syncQueuedRequests() {
  try {
    const db = await openDB();
    const queue = await db.getAll(SYNC_QUEUE_STORE);
    
    for (const item of queue) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body && item.body !== '' ? item.body : undefined,
        });
        
        if (response.ok) {
          // Notify clients that sync completed
          await notifyClientsSync(item, true);
          await db.delete(SYNC_QUEUE_STORE, item.id);
        } else {
          swLogger.warn(`[SW Sync] Fallo con status ${response.status} para ${item.url}`);
        }
      } catch (err) {
        swLogger.warn(`[SW Sync] Error syncing ${item.url}:`, err);
        // Keep in queue for next attempt
      }
    }
  } catch (e) {
    swLogger.error('[SW Sync] Error en sincronización:', e);
  }
}

async function notifyClientsSync(item, success) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      success,
      url: item.url,
      timestamp: Date.now(),
    });
  });
}
