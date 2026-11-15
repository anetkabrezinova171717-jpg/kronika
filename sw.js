// Service worker: aplikace funguje i offline a dá se „nainstalovat“.
// Při každé větší změně aplikace zvyš číslo verze.
const VERSION = 'kronika-v9';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'img/tricko.webp', 'img/logo.svg',
  'js/app.js', 'js/api.js', 'js/store.js', 'js/ui.js', 'js/views.js', 'js/games.js', 'js/admin.js', 'js/config.js', 'js/demo-data.js', 'js/present.js',
];
const IMG_CACHE = 'kronika-img-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== IMG_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Data z Apps Scriptu: vždy ze sítě (aplikace má vlastní záložní cache)
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com') && url.pathname.includes('macros')) return;

  // Písma: nejdřív z cache (fotky z Disku si cachuje prohlížeč sám)
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    e.respondWith(caches.open(IMG_CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Vlastní soubory aplikace: síť (kvůli aktualizacím), offline z cache
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
  }
});
