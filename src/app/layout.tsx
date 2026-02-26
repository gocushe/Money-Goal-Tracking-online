/**
 * layout.tsx  –  Root Layout
 * --------------------------
 * Sets up the HTML shell, loads Geist fonts, and applies global CSS.
 * The `<meta>` viewport tag produced by Next.js ensures a mobile-first
 * experience.  The `dark` class on `<html>` forces permanent dark mode.
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/* ── Font configuration ─────────────────────────────────────── */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* ── SEO / metadata ─────────────────────────────────────────── */
export const metadata: Metadata = {
  title: "Money Goals – Financial Goal Tracker",
  description:
    "A minimalist, mobile-first financial goal tracking application with fluid water-flow animations.",
};

/* ── Root layout component ──────────────────────────────────── */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
