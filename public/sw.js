const CACHE_NAME =
  "waestudio-static-v1";

const PRECACHE_URLS = [
  "/pwa-192.png",
  "/pwa-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener(
  "install",
  (event) => {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) =>
          cache.addAll(
            PRECACHE_URLS
          )
        )
        .then(() =>
          self.skipWaiting()
        )
    );
  }
);

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  key.startsWith(
                    "waestudio-static-"
                  ) &&
                  key !==
                    CACHE_NAME
              )
              .map((key) =>
                caches.delete(
                  key
                )
              )
          )
        )
        .then(() =>
          self.clients.claim()
        )
    );
  }
);

self.addEventListener(
  "fetch",
  (event) => {
    const request =
      event.request;

    if (
      request.method !==
      "GET"
    ) {
      return;
    }

    const url =
      new URL(request.url);

    if (
      url.origin !==
      self.location.origin
    ) {
      return;
    }

    /*
     * MUY IMPORTANTE:
     *
     * Las APIs de reservas,
     * disponibilidad y BCV
     * siempre deben ir a red.
     *
     * Nunca usamos cache
     * para /api/*.
     */
    if (
      url.pathname.startsWith(
        "/api/"
      )
    ) {
      return;
    }

    const isStaticAsset =
      url.pathname.startsWith(
        "/_next/static/"
      ) ||
      PRECACHE_URLS.includes(
        url.pathname
      );

    if (!isStaticAsset) {
      return;
    }

    event.respondWith(
      caches
        .match(request)
        .then(
          async (
            cachedResponse
          ) => {
            if (
              cachedResponse
            ) {
              return cachedResponse;
            }

            const response =
              await fetch(
                request
              );

            if (
              response.ok
            ) {
              const cache =
                await caches.open(
                  CACHE_NAME
                );

              await cache.put(
                request,
                response.clone()
              );
            }

            return response;
          }
        )
    );
  }
);