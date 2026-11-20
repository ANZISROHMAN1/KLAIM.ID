const CACHE_NAME = 'klaim-id-cache-v15';
const urlsToCache = [
  '/',
  '/index.html',
  '/cek_status.html',
  '/admin.html',
  '/static/css/style.css',
  '/static/icons/icon-192x192.png',
  '/static/icons/icon-512x512.png',
  '/logo.jpg',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.warn('Cache addAll warning:', err);
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Dynamic API calls (Google Apps Script / external APIs): Always Network First
  if (url.hostname.includes('script.google.com') || url.pathname.includes('/exec')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Non-GET requests (POST uploads): Do not cache
  if (event.request.method !== 'GET') {
    return;
  }

  // Static Assets & Pages: Cache First, Network Fallback with background revalidation
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Revalidate in background
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
