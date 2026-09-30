const CACHE = "udd-react-2c00388cecbe";
const PRECACHE = ["./","./manifest.webmanifest","./assets/index-BUiahwvC.css","./assets/index-DSiIgu1r.js","./assets/manrope-latin-500-normal-BYYD-dBL.woff2","./assets/manrope-latin-500-normal-DMZssgOp.woff","./assets/manrope-latin-700-normal-BZp_XxE4.woff2","./assets/manrope-latin-700-normal-DGRFkw-m.woff","./assets/roboto-latin-400-normal-BqEyEoaF.woff2","./assets/roboto-latin-400-normal-D27F5sTu.woff","./assets/roboto-latin-500-normal-7RbcRiD8.woff2","./assets/roboto-latin-500-normal-fsTFPL3E.woff","./assets/roboto-latin-700-normal-BZpUvMxY.woff2","./assets/roboto-latin-700-normal-YuyVweIx.woff","./assets/safety-illustrations.png","./assets/udd-seal.png"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("udd-react-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.includes("/api/")
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)),
          );
        }
        return response;
      })
      .catch(() =>
        caches
          .open(CACHE)
          .then((cache) => cache.match(event.request, { ignoreVary: true }))
          .then(
            (cached) =>
              cached ||
              new Response("This resource is not saved offline yet.", {
                status: 503,
              }),
          ),
      ),
  );
});
