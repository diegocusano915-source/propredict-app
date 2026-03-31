// ==========================================================
// PRO PREDICT — SERVICE WORKER (UPDATED)
// FIX: stop serving old cached script.js forever
// STRATEGY:
//  - HTML navigation: Network First (always get latest index.html)
//  - JS/CSS/static: Stale-While-Revalidate (fast, but updates in background)
//  - Versioned cache name to force updates
//  - skipWaiting + clients.claim for immediate activation
// ==========================================================

const CACHE_VERSION = "v2";
const CACHE_NAME = `propredict-${CACHE_VERSION}`;

// Keep precache minimal (do NOT hard-cache script.js forever)
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/styles.css",
  "/styles-v2.css",
  "/styles-ui.css"
];

// ----------------------------------------------------------
// INSTALL
// ----------------------------------------------------------
self.addEventListener("install", (event) => {
  console.log("🛠️ Service worker installing...");

  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// ----------------------------------------------------------
// ACTIVATE
// ----------------------------------------------------------
self.addEventListener("activate", (event) => {
  console.log("✅ Service worker activated");

  event.waitUntil(
    (async () => {
      // Remove old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );

      // Take control immediately
      await self.clients.claim();
    })()
  );
});

// ----------------------------------------------------------
// HELPERS
// ----------------------------------------------------------
function isNavigationRequest(request) {
  return request.mode === "navigate";
}

function isAssetRequest(request) {
  const url = new URL(request.url);
  return (
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".json") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".ttf")
  );
}

// Network First: best for HTML so updates deploy instantly
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const fresh = await fetch(request);
    // Cache copy
    cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}

// Stale While Revalidate: fast for assets, updates in background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((fresh) => {
      cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || Response.error();
}

// ----------------------------------------------------------
// FETCH
// ----------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle same-origin requests (avoid caching 3rd party)
  if (url.origin !== self.location.origin) return;

  // Always bypass service worker for API calls
  // (prevents cached API responses causing stale data/auth issues)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // HTML navigation -> Network First
  if (isNavigationRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets -> Stale While Revalidate
  if (isAssetRequest(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default: try cache, then network
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
