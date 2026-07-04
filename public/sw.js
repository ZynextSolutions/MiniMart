const CACHE_NAME = "pos-v2-static";
const CACHEABLE_PREFIXES = ["/_next/static/", "/icons/", "/manifest.json"];
const CACHEABLE_EXACT = new Set(["/"]);

function isCacheableRequest(url) {
  if (url.pathname.startsWith("/api/")) return false;
  if (CACHEABLE_EXACT.has(url.pathname)) return true;
  return CACHEABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(["/manifest.json"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (!isCacheableRequest(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "pos-sync") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "POS_SYNC" }));
      }),
    );
  }
});
