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
        src: "/waestudio-app-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/waestudio-app-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/waestudio-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}