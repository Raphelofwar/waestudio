import type {
  Metadata,
  Viewport,
} from "next";

import {
  Geist,
  Geist_Mono,
} from "next/font/google";

import "./globals.css";
import ThemeRegistry from "./ThemeRegistry";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

const geistSans = Geist({
  variable:
    "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable:
    "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://waestudio.vercel.app"
  ),

  title: {
    default: "WAESTUDIO",
    template:
      "%s | WAESTUDIO",
  },

  description:
    "Reserva tu cita en segundos. Sin complicaciones.",

  applicationName:
    "WAESTUDIO",

  manifest: "/manifest.webmanifest",

  icons: {
    icon: [
      {
        url: "/pwa-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/pwa-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],

    apple: [
      {
        url:
          "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },

  appleWebApp: {
    capable: true,

    title: "WAESTUDIO",

    statusBarStyle:
      "black-translucent",
  },

  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",

  initialScale: 1,

  viewportFit: "cover",

  themeColor: "#090909",
};

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen bg-[#090909] text-[#f5f1e8] antialiased">
        <ThemeRegistry>
          <ServiceWorkerRegister />

          {children}
        </ThemeRegistry>
      </body>
    </html>
  );
}