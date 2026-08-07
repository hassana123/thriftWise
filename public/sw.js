const CACHE = "thriftwise-static-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          "/manifest.json",
          "/icon-192.png",
          "/icon-512.png",
          "/icon-512-maskable.png",
          "/apple-icon.png",
        ])
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Never cache page navigations or Next.js RSC/prefetch payloads. Caching them
  // serves stale HTML after login/logout, which shows up as flickering/glitching
  // on phones until a hard refresh clears the cache.
  if (request.mode === "navigate") return;
  if (url.searchParams.has("_rsc")) return;
  if (request.headers.get("next-router-prefetch") === "1") return;

  // Only cache immutable static assets. Hashed files in /_next/static can never
  // go stale; icons and the manifest are also safe to serve from cache.
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.json" ||
    /^\/(icon-[^/]+|apple-icon)\.png$/.test(url.pathname);

  if (!isStatic) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
