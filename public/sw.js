const CACHE_NAME = 'nexus-v5-fix';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/base.css',
  '/css/welcome.css',
  '/css/themes/professional.css',
  '/css/themes/midnight-hacker.css',
  '/css/themes/sakura-garden.css',
  '/css/themes/space-odyssey.css',
  '/css/themes/retro-arcade.css',
  '/css/themes/ocean-breeze.css',
  '/css/themes/jarvis.css',
  '/css/apps/calendar.css',
  '/css/apps/notes.css',
  '/css/apps/todo.css',
  '/css/apps/weather.css',
  '/css/apps/it-hub.css',
  '/css/apps/auth.css',
  '/css/apps/phone-bridge.css',
  '/css/apps/arcade.css',
  '/css/apps/finance.css',
  '/js/app.js',
  '/js/welcome.js',
  '/js/apps/calendar.js',
  '/js/apps/notes.js',
  '/js/apps/todo.js',
  '/js/apps/gcal-sync.js',
  '/js/apps/gcal-outbound.js',
  '/js/apps/weather.js',
  '/js/apps/it-hub.js',
  '/js/apps/auth.js',
  '/js/apps/phone-bridge.js',
  '/js/apps/arcade.js',
  '/js/apps/finance.js',
  '/js/apps/backup.js',
  '/manifest.json',
  '/assets/icons/icon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
      .catch(err => console.warn('[SW] Precache failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // API calls: network only
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(request));
    return;
  }

  // Navigation fallback to index.html
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html').then(r => r || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // Stale-while-revalidate for everything else
  e.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
