// Book Tracker service worker.
// Caches the app shell so the app opens instantly and works offline.
// Deliberately does NOT cache anything sent to an external backend
// (AI/translate calls) — those need a live network connection anyway.

const CACHE_NAME = 'book-tracker-shell-v13';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept cross-origin calls (this is how the AI backend is reached).
  if (url.origin !== self.location.origin) return;

  // App shell: cache-first, so the app opens instantly offline.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        if (resp.ok && event.request.method === 'GET') {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});

// Lets the page tell a waiting worker to activate immediately after an update,
// so "seamless update" actually means something here: next reload picks up
// the new shell rather than serving a stale cached copy indefinitely.
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});