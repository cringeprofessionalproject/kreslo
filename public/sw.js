const CACHE_NAME = 'heuristics-kreslo-sim-v36';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/fonts/fonts.css',
  './icon-180.png',
  './icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Умное кэширование для экономии трафика CDN и мгновенной загрузки:
// - тяжелые неизменяемые ассеты (шрифты, WASM-модель лица, портреты, звук) — Cache-First (качаются 1 раз);
// - оболочка игры (HTML/JS/CSS) — Network-First с офлайн-резервом.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (!url.startsWith(self.location.origin) || url.includes('/api/')) return;

  const isHeavyStaticAsset =
    url.includes('/assets/mediapipe/') ||
    url.includes('/assets/fonts/') ||
    url.includes('/assets/portraits/') ||
    url.includes('/assets/plates/') ||
    url.includes('/assets/broll/') ||
    url.includes('/assets/clips/') ||
    url.includes('/assets/voice/');

  if (isHeavyStaticAsset) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
