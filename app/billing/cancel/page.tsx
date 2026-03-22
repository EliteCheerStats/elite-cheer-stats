import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-3xl font-extrabold text-white">
          Checkout canceled
        </h1>

        <p className="mt-3 text-slate-300">
          No worries — your subscription was not changed.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/upgrade"
            className="rounded-md bg-teal-400 px-4 py-2 font-semibold text-slate-900 hover:opacity-90"
          >
            Back to Upgrade
          </Link>

          <Link
            href="/"
            className="rounded-md border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
          >
            Continue Free
          </Link>
        </div>
      </div>
    </main>
  );
}