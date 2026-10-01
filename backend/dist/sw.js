/**
 * BSC Textiles Safe Static Asset Service Worker
 *
 * Implements high-performance caching for static assets (hashed JS, CSS, images, fonts)
 * while strictly bypassing all API requests, authentication routes, and dynamic data.
 */

// Bumped when the app bundle changes in a way that must not be served from an old
// cache: `activate` deletes every cache except the current name, so the previous
// version's hashed chunks cannot come back after a deploy.
const CACHE_NAME = 'bsc-static-v2';

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

  // 1. STRICT SECURITY BYPASS: Never intercept non-GET, API calls, uploads, or auth routes
  if (
    req.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/uploads') ||
    url.pathname.includes('/auth') ||
    url.pathname.includes('/wedding-crm')
  ) {
    return; // Let browser handle naturally
  }

  // 2. CACHE-FIRST for Content-Hashed Asset Bundles (/assets/*)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 3. STALE-WHILE-REVALIDATE for Static Images & Google Fonts
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
            if (networkRes.status === 200) {
              const clone = networkRes.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, clone));
            }
            return networkRes;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 4. Default network-first with cache fallback
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
