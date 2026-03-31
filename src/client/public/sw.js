const CACHE_NAME = 'kinbot-v2';

// App shell files to cache
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/kinbot.svg',
  '/kinbot-192.png',
  '/kinbot-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle http(s) requests — skip chrome-extension://, etc.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return;
  }

  // Skip SSE, API calls, and WebSocket upgrades - always go to network
  if (
    url.pathname.startsWith('/api/') ||
    request.headers.get('accept') === 'text/event-stream'
  ) {
    return;
  }

  // Network-first for navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
        }
        return response;
      });
      return cached || fetchPromise;
    })
  );
});
