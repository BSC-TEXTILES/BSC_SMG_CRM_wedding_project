/**
 * BSC Textiles Safe Static Asset Service Worker
 *
 * Implements high-performance caching for static assets (hashed JS, CSS, images, fonts)
 * while strictly bypassing all API requests, authentication routes, and dynamic data.
 *
 * SPA navigation requests (HTML pages) are served network-first with a fallback to
 * the cached /index.html shell so React Router can handle client-side routing even
 * when the network is flaky.
 */

// Bumped on every deploy so the previous cache is purged on activation.
const CACHE_NAME = 'bsc-static-v3';

const STATIC_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/Main_logo_web.png',
  '/Main_logo_mobile.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL).catch((err) => {
        console.warn('[SW] Pre-caching non-fatal warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin &&
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('fonts.gstatic.com')) {
    return;
  }

  // 1. STRICT BYPASS: Never intercept non-GET, API calls, uploads, or auth routes.
  //    Returning without calling event.respondWith() lets the browser handle natively.
  if (
    req.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/uploads') ||
    url.pathname.includes('/auth') ||
    url.pathname.includes('/wedding-crm')
  ) {
    return;
  }

  // 2. CACHE-FIRST for content-hashed asset bundles (/assets/*)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        }).catch(() => {
          // Asset not in cache and network failed — return a minimal error response
          // so event.respondWith never receives undefined.
          return new Response('', { status: 503, statusText: 'Service Unavailable' });
        });
      })
    );
    return;
  }

  // 3. STALE-WHILE-REVALIDATE for static images & Google Fonts
  if (
    url.pathname.startsWith('/images/') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const clone = networkRes.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, clone));
            }
            return networkRes;
          })
          .catch(() => cached || new Response('', { status: 503, statusText: 'Service Unavailable' }));
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 4. SPA NAVIGATION: HTML page requests (mode: 'navigate') should serve
  //    /index.html from cache when the network is down so React Router can
  //    render the correct view client-side.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          return caches.match(req)
            .then((cached) => cached || caches.match('/index.html'))
            .then((fallback) => fallback || new Response('Offline', { status: 503, statusText: 'Service Unavailable' }));
        })
    );
    return;
  }

  // 5. Default: network-first with cache fallback (non-navigation GETs)
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      })
      .catch(() => {
        return caches.match(req)
          .then((cached) => cached || new Response('', { status: 503, statusText: 'Service Unavailable' }));
      })
  );
});
