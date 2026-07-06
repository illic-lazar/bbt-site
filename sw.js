/* Big Bad Thai service worker — conservative: HTML network-first (always fresh online),
   assets stale-while-revalidate, never touches /api or cross-origin. Bump V to invalidate. */
const V = 'bbt-v4';
const CORE = ['/', '/menu.html', '/about.html', '/gallery.html', '/visit.html', '/assets/site.css', '/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;        // leave fonts / maps / etc. alone
  if (url.pathname.startsWith('/api/')) return;       // never cache live reviews

  if (req.mode === 'navigate') {                      // pages: network-first, cache fallback (offline)
    e.respondWith(
      fetch(req).then(r => { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); return r; })
        .catch(() => caches.match(req).then(m => m || caches.match('/')))
    );
    return;
  }

  // assets: serve cache fast, refresh in background
  e.respondWith(
    caches.match(req).then(m => {
      const net = fetch(req).then(r => { caches.open(V).then(c => c.put(req, r.clone())); return r; }).catch(() => m);
      return m || net;
    })
  );
});
