import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
          Gym Dashboard Administration
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Admin Dashboard
        </h1>

        <p className="mt-2 max-w-3xl text-slate-600">
          Review new Gym Dashboard requests, provision customer access,
          and manage existing organizations.
        </p>
      </div>

      <section>
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Onboarding
          </p>

          <h2 className="mt-1 text-xl font-bold text-slate-950">
            Customer Onboarding
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            New Gym Dashboard customers enter through the onboarding queue.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Link
            href="/admin/trial-requests"
            className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-sm font-semibold text-blue-600">
              Primary workflow
            </div>

            <h3 className="mt-2 text-2xl font-bold text-slate-950">
              Onboarding Queue
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review incoming requests, manage onboarding status, and
              provision standard or multi-location Gym Dashboard customers.
            </p>

            <div className="mt-5 text-sm font-bold text-blue-700">
              Open Onboarding Queue →
            </div>
          </Link>

          <Link
            href="/admin/assign-users"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-sm font-semibold text-slate-500">
              Administrative utility
            </div>

            <h3 className="mt-2 text-xl font-bold text-slate-950">
              Assign Users
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Add an existing ECS user to an existing organization outside
              the normal onboarding workflow.
            </p>

            <div className="mt-5 text-sm font-bold text-slate-700">
              Assign User →
            </div>
          </Link>
        </div>
      </section>

      <section className="mt-10 border-t border-slate-200 pt-8">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Organizations
            </div>

            <h3 className="mt-2 text-lg font-bold text-slate-700">
              Organization Management
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Organization inspection and support tools will live here as
              they are added.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Operations
            </div>

            <h3 className="mt-2 text-lg font-bold text-slate-700">
              System Operations
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Imports, system health, and internal operational tools will
              live here.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}