import Link from "next/link";

export default function BillingSuccessPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-3xl font-extrabold text-white">
          Payment successful
        </h1>

        <p className="mt-3 text-slate-300">
          Your subscription is being activated now.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/account"
            className="rounded-md bg-teal-400 px-4 py-2 font-semibold text-slate-900 hover:opacity-90"
          >
            Go to Account
          </Link>

          <Link
            href="/compare"
            className="rounded-md border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
          >
            Continue to Premium!
          </Link>
        </div>
      </div>
    </main>
  );
}