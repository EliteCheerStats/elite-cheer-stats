import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import SubscriptionButton from "@/app/components/SubscriptionButton";
import Script from "next/script";
import SiteChrome from "./SiteChrome";
import GymDashboardNavLink from "@/app/components/GymDashboardNavLink";

export const metadata: Metadata = {
  title: "Elite Cheer Stats | Competitive Cheer Analytics Platform",
  description:
    "Elite Cheer Stats provides competitive cheer analytics, team comparisons, rankings, and performance insights for All-Star cheerleading.",
  verification: {
    google: "oHBzHb2mt2eoERIRB4U4SUvHfv2IUxWKzcmOY6qm1Fo",
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function PublicSiteChrome({
  children,
  showGymDashboardLink = false,
}: {
  children: React.ReactNode;
  showGymDashboardLink?: boolean;
}) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/" className="text-lg font-bold tracking-tight">
            Elite Cheer <span className="text-teal-400">Stats</span>
          </a>

          <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-200 sm:gap-4">
            <a className="hover:text-white" href="/about">
              About
            </a>

            <a className="hover:text-white" href="/rankings">
              Rankings
            </a>

            <a className="hover:text-white" href="/team">
              Team Search
            </a>

            <a
              className="rounded-lg border border-teal-400/30 px-3 py-1.5 text-teal-200 hover:bg-teal-500/10"
              href="/compare"
            >
              Team Comparison
            </a>

            <a
              className="rounded-lg bg-teal-500/15 px-3 py-1.5 text-teal-200 hover:bg-teal-500/25"
              href="/comp-builder"
            >
              Comp Builder
            </a>

            <a
              className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-1.5 text-rose-200 hover:bg-rose-500/20"
              href="/summit-builder"
            >
              Summit Builder
            </a>

            <GymDashboardNavLink />

            <SubscriptionButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>

      <footer className="mt-12 border-t border-slate-800 py-6 text-center text-xs text-slate-400">
        © 2026 Elite Cheer Stats · contactus@elitecheerstats.com ·
        <a href="/privacy" className="ml-1 underline">
          Privacy
        </a>{" "}
        ·
        <a href="/terms" className="ml-1 underline">
          Terms
        </a>
      </footer>
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {


  return (
    <html lang="en">
      <Script
        id="fb-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '3528408800657813');
            fbq('track', 'PageView');
          `,
        }}
      />

      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-950 text-white antialiased`}
      >


        <SiteChrome
          publicSiteChrome={
            <PublicSiteChrome>
  {children}
</PublicSiteChrome>
          }
        >
          {children}
        </SiteChrome>

        <Analytics />
      </body>
    </html>
  );
}