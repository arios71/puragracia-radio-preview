const CACHE_NAME = 'pgr-preview-v3';
const APP_BASE = new URL('./', self.location.href);
const STATIC_ASSETS = [
  '',
  'index.html',
  'css/styles.css',
  'js/radio.js',
  'js/menu.js',
  'js/nowplaying.js',
  'js/schedule.js',
  'js/sermones.js',
  'manifest.json',
  'assets/branding/logo-horizontal.webp',
  'default-cover.png',
  'assets/icons/logo-32.png',
  'assets/icons/logo-192.png',
  'assets/icons/logo-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/whatsapp.png'
].map(path => new URL(path, APP_BASE).href);

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(err => console.error('No se pudo completar el caché inicial:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(name => name.startsWith('pgr-preview-') && name !== CACHE_NAME)
        .map(name => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (
    url.hostname.includes('radioboss.fm') ||
    url.hostname.includes('streamtheworld.com') ||
    url.hostname.includes('vercel.app') ||
    /\.(mp3|aac|m3u8)(?:$|\?)/i.test(url.href)
  ) return;

  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(new URL('index.html', APP_BASE).href))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && url.origin === self.location.origin &&
            url.pathname.startsWith(APP_BASE.pathname)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
