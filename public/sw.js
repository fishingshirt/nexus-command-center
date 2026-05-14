const CACHE_NAME = 'nexus-v6-fix';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/base.css',
  '/css/welcome.css',
  '/css/themes/jarvis.css',
  '/css/themes/jarvis-light.css',
  '/css/themes/professional.css',
  '/css/themes/midnight-hacker.css',
  '/css/themes/sakura-garden.css',
  '/css/themes/space-odyssey.css',
  '/css/themes/retro-arcade.css',
  '/css/themes/ocean-breeze.css',
  '/css/apps/calendar.css',
  '/css/apps/notes.css',
  '/css/apps/todo.css',
  '/css/apps/weather.css',
  '/css/apps/it-hub.css',
  '/css/apps/auth.css',
  '/css/apps/phone-bridge.css',
  '/css/apps/arcade.css',
  '/css/apps/finance.css',
  '/css/apps/finance-tracker.css',
  '/css/apps/pomodoro.css',
  '/css/apps/worldclock.css',
  '/css/apps/news.css',
  '/css/apps/wishlist.css',
  '/css/apps/email.css',
  '/css/apps/rss.css',
  '/css/apps/pdf-editor.css',
  '/css/apps/vault.css',
  '/css/apps/recipe.css',
  '/css/apps/ai-suggester.css',
  '/css/apps/bookmarks.css',
  '/css/apps/shortcuts.css',
  '/css/widgets/grid.css',
  '/css/quick-capture.css',
  '/js/app.js',
  '/js/welcome.js',
  '/js/notifications.js',
  '/js/theme-autoswitch.js',
  '/js/lib/storage-adapter.js',
  '/js/lib/migrate-legacy.js',
  '/js/lib/attachment-store.js',
  '/js/widgets/grid.js',
  '/js/widgets/factories.js',
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
  '/js/apps/pomodoro.js',
  '/js/apps/worldclock.js',
  '/js/apps/news.js',
  '/js/apps/rss.js',
  '/js/apps/pdf.js',
  '/js/apps/vault.js',
  '/js/apps/wishlist.js',
  '/js/apps/recipe.js',
  '/js/apps/ai-suggester.js',
  '/js/apps/shortcuts.js',
  '/js/apps/email.js',
  '/js/apps/bookmarks.js',
  '/js/apps/finance-tracker.js',
  '/js/apps/quick-capture.js',
  '/manifest.json',
  '/assets/icons/icon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/audio/build-report.ogg'
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
