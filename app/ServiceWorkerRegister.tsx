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

    const registerServiceWorker =
      async () => {
        try {
          await navigator.serviceWorker.register(
            "/sw.js",
            {
              scope: "/",
            }
          );

          console.log(
            "WAESTUDIO service worker registrado."
          );
        } catch (error) {
          console.error(
            "Error registrando service worker:",
            error
          );
        }
      };

    registerServiceWorker();
  }, []);

  return null;
}