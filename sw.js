const CACHE_NAME = 'pgr-v57';

// Archivos estáticos principales
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/radio.js',
  '/js/menu.js',
  '/js/nowplaying.js',
  '/js/schedule.js',
  '/manifest.json',
  '/assets/icons/logo-32.png',
  '/assets/icons/logo-192.png',
  '/assets/icons/logo-512.png',
  '/assets/icons/icon-maskable-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/whatsapp.png'
];

// =========================
// INSTALL
// =========================
self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(err => {
        console.error('Cache addAll failed:', err);
      })
  );
});

// =========================
// ACTIVATE
// =========================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// =========================
// FETCH (SPA STRATEGY)
// =========================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 🔴 NO cachear streaming ni audio en vivo
  if (
    url.hostname.includes('streamtheworld.com') ||
    url.pathname.includes('.mp3') ||
    url.pathname.includes('.aac') ||
    url.pathname.includes('.m3u8')
  ) {
    return;
  }

  // 🟢 NAVIGATION REQUESTS (SPA fallback)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          return response;
        })
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 🟢 STATIC ASSETS → cache first, then network
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then(networkResponse => {
        // ✅ SOLO cacheamos si es una petición GET (y no Analytics)
        if (event.request.method === 'GET' && 
            !event.request.url.includes('google-analytics') && 
            !event.request.url.includes('googletagmanager')) {
          
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      });
    })
  );
});
