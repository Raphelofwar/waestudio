
"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const setupServiceWorker = async () => {
      try {
        // En desarrollo no debemos utilizar
        // Service Workers ni conservar su caché.
        if (process.env.NODE_ENV !== "production") {
          const registrations =
            await navigator.serviceWorker.getRegistrations();

          const localScope = new URL(
            "/",
            window.location.origin
          ).href;

          for (const registration of registrations) {
            if (registration.scope === localScope) {
              await registration.unregister();
            }
          }

          // Eliminar cachés anteriores de WAESTUDIO.
          if ("caches" in window) {
            const cacheNames = await caches.keys();

            await Promise.all(
              cacheNames
                .filter((name) =>
                  name.startsWith("waestudio-static-")
                )
                .map((name) => caches.delete(name))
            );
          }

          console.log(
            "WAESTUDIO: Service Worker desactivado en desarrollo."
          );

          return;
        }

        // En producción conservamos la PWA instalable.
        const registration =
          await navigator.serviceWorker.register(
            "/sw.js",
            {
              scope: "/",
              updateViaCache: "none",
            }
          );

        // Solicitar la versión actualizada
        // del Service Worker.
        await registration.update();

        console.log(
          "WAESTUDIO: Service Worker registrado y actualizado."
        );
      } catch (error) {
        console.error(
          "WAESTUDIO: Error configurando Service Worker:",
          error
        );
      }
    };

    void setupServiceWorker();
  }, []);

  return null;
}
