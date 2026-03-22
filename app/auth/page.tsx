import { Suspense } from "react";
import AuthPageClient from "./AuthPageClient";

function AuthPageFallback() {
  return (
    <main className="min-h-screen bg-[#020b2d] text-white">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-2xl border border-white/10 bg-[#03123b] p-8">
          <h1 className="text-3xl font-bold">Loading…</h1>
          <p className="mt-3 text-white/75">Preparing sign in…</p>
        </div>
      </section>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <AuthPageClient />
    </Suspense>
  );
}