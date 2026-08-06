import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
          ECS Internal Tools
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Admin Console
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Manage users, organizations, team mappings, imports, and system tools.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/admin/assign-users"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="text-sm font-semibold text-blue-600">Available now</div>
          <h2 className="mt-2 text-xl font-bold text-slate-950">
            Assign Users
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Find an ECS user and assign access to an existing organization.
          </p>
        </Link>

        {[
          ["Team Mapping", "Map ECS teams to organizations."],
          ["Organization Viewer", "Review users, teams, access, and subscription status."],
          ["User Lookup", "Review memberships and product access."],
          ["View as Organization", "Open Gym Dashboard in a read-only support mode."],
        ].map(([title, description]) => (
          <div
            key={title}
            className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6"
          >
            <div className="text-sm font-semibold text-slate-400">Coming soon</div>
            <h2 className="mt-2 text-xl font-bold text-slate-700">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
