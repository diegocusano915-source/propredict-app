// ==========================================================
// PRO PREDICT — SERVICE WORKER
// BASIC CACHE (SAFE START)
// ==========================================================

const CACHE_NAME = "propredict-v1";

const urlsToCache = [
  "/",
  "/index.html",
  "/styles.css",
  "/script.js"
];

// INSTALL
self.addEventListener("install", (event) => {
  console.log("🧠 Service Worker installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// ACTIVATE
self.addEventListener("activate", (event) => {
  console.log("⚡ Service Worker activated");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// FETCH
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
