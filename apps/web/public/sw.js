const CACHE = "nextfi-shell-v4";
const PUBLIC_SHELL = [
  "/",
  "/offline",
  "/app",
  "/app/portfolio",
  "/app/transactions",
  "/app/dca-plans",
  "/app/help",
  "/app/market",
  "/app/insights",
  "/app/settings",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/maskable-512.png",
  "/crypto/btc.svg",
  "/crypto/eth.svg",
  "/crypto/sol.svg",
  "/crypto/bnb.svg",
  "/crypto/link.svg",
  "/crypto/hype.svg",
  "/crypto/xlm.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && (url.pathname === "/" || url.pathname.startsWith("/app"))) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const exact = await caches.match(request);
          return exact || caches.match("/offline");
        }),
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon") ||
    url.pathname.startsWith("/maskable") ||
    url.pathname.startsWith("/crypto/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
      ),
    );
  }
});
