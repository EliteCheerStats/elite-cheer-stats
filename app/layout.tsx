import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import Image from "next/image";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Elite Cheer Stats",
  description: "The most advanced cheer analytics platform ever built.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-white`}
      >
        <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur">

          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <a href="/" className="text-lg font-bold tracking-tight">
              Elite Cheer <span className="text-teal-400">Stats</span>
            </a>

            <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-200 sm:gap-4">
  <a className="hover:text-white" href="/rankings">
    Rankings
  </a>
  <a className="hover:text-white" href="/team">
    Team Search
  </a>
  <a
    className="rounded-lg bg-teal-500/15 px-3 py-1.5 text-teal-200 hover:bg-teal-500/25"
    href="/comp-builder"
  >
    Comp Builder
  </a>

  <span className="ml-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium tracking-wide text-amber-200">
  Free Beta • Premium Coming
</span>
</nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-2 text-xs text-slate-400 sm:px-6">
          © {new Date().getFullYear()} Elite Cheer Stats
        </footer>

        <Analytics />
      </body>
    </html>
  );
}