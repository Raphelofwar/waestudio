import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import ThemeRegistry from "./ThemeRegistry";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "WAESTUDIO",
    template: "%s | WAESTUDIO",
  },

  description:
    "Reserva tu cita en WAESTUDIO de forma rápida y sencilla.",

  applicationName: "WAESTUDIO",

  keywords: [
    "WAESTUDIO",
    "barbería",
    "barberia",
    "citas",
    "reservas",
    "grooming",
  ],

  authors: [
    {
      name: "WAESTUDIO",
    },
  ],

  creator: "WAESTUDIO",

  metadataBase: new URL(
    "https://waestudio.vercel.app"
  ),

  openGraph: {
    title: "WAESTUDIO",
    description:
      "Reserva tu cita en segundos. Sin complicaciones.",
    siteName: "WAESTUDIO",
    type: "website",
    locale: "es_VE",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#090909] text-[#f5f1e8]">
        <ThemeRegistry>
          {children}
        </ThemeRegistry>
      </body>
    </html>
  );
}