import TrialRequestsQueue from "@/components/admin/TrialRequestsQueue";

export default function TrialRequestsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
          Gym Dashboard
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-950">
  Onboarding Queue
</h1>

        <p className="mt-2 max-w-3xl text-slate-600">
  Review, provision, and manage new Gym Dashboard customers.
</p>
      </div>

      <TrialRequestsQueue />
    </div>
  );
}