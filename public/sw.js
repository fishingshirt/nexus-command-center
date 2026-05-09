const CACHE_NAME = 'nexus-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/base.css',
  '/css/themes/professional.css',
  '/css/themes/midnight-hacker.css',
  '/css/themes/sakura-garden.css',
  '/css/themes/space-odyssey.css',
  '/css/themes/retro-arcade.css',
  '/css/themes/ocean-breeze.css',
  '/js/app.js',
  '/manifest.json',
  '/assets/icons/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
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
  // Network-first for API calls, cache-first for static assets
  if (e.request.url.includes('/api/')) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then(cached => cached || new Response('Offline')))
  );
});
