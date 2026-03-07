// ╔══════════════════════════════════════════════════════════════╗
// ║          SmartEconomato Service Worker v1.0.0               ║
// ║     Cache-First (static) + Network-First (API)              ║
// ╚══════════════════════════════════════════════════════════════╝

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `smart-economato-static-${CACHE_VERSION}`;
const API_CACHE = `smart-economato-api-${CACHE_VERSION}`;

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/cliente/',
  '/cliente/index.html',
  '/cliente/manifest.webmanifest',
  '/cliente/icon-192x192.png',
  '/cliente/icon-512x512.png',
];

// API routes to cache with network-first strategy
const API_CACHE_PATTERNS = [
  /\/api\/products/,
  /\/api\/recipes/,
  /\/api\/allergens/,
  /\/api\/suppliers/,
];

// ─── Install: pre-cache static shell ───────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: clean up old caches ─────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch: routing strategy ────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and browser-extension requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // Skip auth endpoints – always go to network
  if (url.pathname.includes('/api/auth')) return;

  // API calls: Network-First with cache fallback
  if (API_CACHE_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
    return;
  }

  // Static assets & app shell: Cache-First
  if (
    url.pathname.includes('/assets/') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf)$/)
  ) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // Navigation requests (SPA routes): serve index.html from cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/cliente/index.html')
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
    }
    return network;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Sin conexión', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
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
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
