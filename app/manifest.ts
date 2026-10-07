import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WAESTUDIO",
    short_name: "WAESTUDIO",

    description:
      "Reserva tu cita en segundos. Sin complicaciones.",

    start_url: "/",

    scope: "/",

    display: "standalone",

    background_color: "#090909",

    theme_color: "#090909",

    orientation: "portrait",

    categories: [
      "beauty",
      "lifestyle",
    ],

    lang: "es-VE",

    icons: [
      {
        src: "/pwa-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}