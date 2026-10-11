
const CACHE_NAME = "waestudio-static-v3";

const PRECACHE_URLS = [
  "/waestudio-app-192.png",
  "/waestudio-app-512.png",
  "/waestudio-maskable-512.png",
  "/waestudio-apple-180.png",
];

/*
 * WAESTUDIO SERVICE WORKER
 *
 * Versión 3
 *
 * Objetivos:
 * - Mantener la aplicación instalable.
 * - Guardar únicamente los iconos.
 * - No almacenar páginas ni código de Next.js.
 * - No almacenar respuestas de las API.
 * - Eliminar cachés antiguas.
 */

// ========================================
// INSTALACIÓN
// ========================================

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(
        CACHE_NAME
      );

      await cache.addAll(
        PRECACHE_URLS
      );

      // Activar la nueva versión sin esperar
      // a que se cierren todas las pestañas.
      await self.skipWaiting();
    })()
  );
});

// ========================================
// ACTIVACIÓN
// ========================================

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      const oldCaches = cacheNames.filter(
        (name) =>
          name.startsWith(
            "waestudio-static-"
          ) &&
          name !== CACHE_NAME
      );

      await Promise.all(
        oldCaches.map(
          (name) => caches.delete(name)
        )
      );

      // Permitir que esta versión controle
      // las páginas abiertas.
      await self.clients.claim();
    })()
  );
});

// ========================================
// SOLICITUDES
// ========================================

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Solo solicitudes GET.
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Ignorar servicios externos.
  if (
    url.origin !== self.location.origin
  ) {
    return;
  }

  /*
   * No intervenir en:
   *
   * - Páginas de WAESTUDIO
   * - Archivos /_next/static/
   * - Archivos JavaScript
   * - Archivos CSS
   * - API de reservas
   * - API de disponibilidad
   * - API del BCV
   * - Google Calendar
   *
   * El navegador y Next.js gestionarán
   * normalmente estas solicitudes.
   */

  const isAppIcon =
    PRECACHE_URLS.includes(
      url.pathname
    );

  if (!isAppIcon) {
    return;
  }

  /*
   * Únicamente para los iconos:
   *
   * Primero intentar obtener la versión
   * actualizada desde Internet.
   *
   * Si no hay conexión, utilizar
   * la versión guardada.
   */

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(
          request
        );

        if (response.ok) {
          const cache = await caches.open(
            CACHE_NAME
          );

          await cache.put(
            request,
            response.clone()
          );
        }

        return response;
      } catch {
        const cache = await caches.open(
          CACHE_NAME
        );

        const cachedResponse =
          await cache.match(request, {
            ignoreSearch: true,
          });

        if (cachedResponse) {
          return cachedResponse;
        }

        return Response.error();
      }
    })()
  );
});
