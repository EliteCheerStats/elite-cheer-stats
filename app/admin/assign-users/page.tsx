import AssignUserToOrganization from "@/components/admin/AssignUserToOrganization";

export default function AssignUsersPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
          Organizations
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Assign User Access
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Confirm an ECS account exists, select an organization, and add owner access.
        </p>
      </div>

      <AssignUserToOrganization />
    </div>
  );
}
