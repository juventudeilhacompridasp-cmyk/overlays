// Service worker mínimo: abre as páginas públicas e o portal mesmo com conexão ruim.
// Rede primeiro; só usa o cache quando a rede falha. Nunca guarda chamadas /api/.
const CACHE = 'juventude-shell-v1';
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/app.js', '/styles.css', '/brand-logo.png', '/manifest.webmanifest'])).catch(() => {}));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
    return response;
  }).catch(() => caches.match(request).then(hit => hit || caches.match('/'))));
});
