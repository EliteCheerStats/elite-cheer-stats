"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GymDashboardSidebar from "@/app/gym-dashboard/components/GymDashboardSidebar";
import { supabase } from "@/lib/supabaseClient";

type SavedReport = {
  id: string;
  report_name: string;
  division: string | null;
  team_ids: string[] | null;
  created_at: string;
};

export default function SavedCompetitionReportsPage() {
  const router = useRouter();

  const [reports, setReports] = useState<SavedReport[]>([]);
  const [orgName, setOrgName] = useState("Gym Dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSavedReports() {
      setLoading(true);
      setError(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      const userId = session?.user?.id;

      if (sessionError || !userId) {
        setError("Please log in to view saved reports.");
        setLoading(false);
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("v_user_organizations")
        .select("organization_id, organization_name")
        .eq("user_id", userId)
        .eq("subscription_status", "active")
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        setError(membershipError.message);
        setLoading(false);
        return;
      }

      if (!membership?.organization_id) {
        setError("No active gym organization found for this account.");
        setLoading(false);
        return;
      }

      setOrgName(membership.organization_name ?? "Gym Dashboard");

      const { data: reportRows, error: reportsError } = await supabase
        .from("competition_reports")
        .select(
          "id, report_name, division, team_ids, created_at"
        )
        .eq("organization_id", membership.organization_id)
        .order("created_at", { ascending: false });

      if (reportsError) {
        setError(reportsError.message);
        setLoading(false);
        return;
      }

      setReports((reportRows ?? []) as SavedReport[]);
      setLoading(false);
    }

    loadSavedReports();
  }, []);

  function formatSavedDate(value: string) {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen w-full bg-slate-50 text-slate-950">
        <GymDashboardSidebar
          organizationName={orgName}
          role="Owner"
        />

        <main className="ml-64 flex flex-1 items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 font-semibold shadow-sm">
            Loading Saved Reports...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-950">
      <GymDashboardSidebar
        organizationName={orgName}
        role="Owner"
      />

      <main className="ml-64 min-w-0 flex-1 overflow-x-hidden p-6 xl:p-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-6 flex items-start justify-between gap-6">
            <div>
              <button
                onClick={() =>
                  router.push(
                    "/gym-dashboard/competition-intelligence"
                  )
                }
                className="mb-4 text-sm font-semibold text-purple-700 hover:text-purple-900"
              >
                ← Back to Competition Intelligence
              </button>

              <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
                Competition Intelligence
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Saved Reports
              </h1>

              <p className="mt-1 text-slate-500">
                Reopen previously generated Competition Intelligence reports.
              </p>
            </div>

            <button
              onClick={() =>
                router.push(
                  "/gym-dashboard/competition-intelligence"
                )
              }
              className="rounded-xl bg-purple-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-purple-700"
            >
              Build New Field
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-white p-5 text-sm font-semibold text-red-700 shadow-sm">
              {error}
            </div>
          )}

          {!error && reports.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="text-xl font-bold text-slate-950">
                No saved reports yet
              </div>

              <p className="mt-2 text-sm text-slate-500">
                Generate a Competition Intelligence report and select Save
                Report to add it here.
              </p>

              <button
                onClick={() =>
                  router.push(
                    "/gym-dashboard/competition-intelligence"
                  )
                }
                className="mt-5 rounded-xl bg-purple-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-purple-700"
              >
                Build a Competition Field
              </button>
            </div>
          )}

          {!error && reports.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-lg font-bold text-slate-950">
                  Report History
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {reports.length} saved report
                  {reports.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <th className="px-6 py-4">Report</th>
                      <th className="px-6 py-4">Division</th>
                      <th className="px-6 py-4">Teams</th>
                      <th className="px-6 py-4">Saved</th>
                      <th className="px-6 py-4 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {reports.map((report) => (
                      <tr
                        key={report.id}
                        onClick={() =>
                          router.push(
                            `/gym-dashboard/competition-intelligence/reports/${report.id}`
                          )
                        }
                        className="cursor-pointer border-b border-slate-100 bg-white transition hover:bg-purple-50"
                      >
                        <td className="px-6 py-5">
                          <div className="font-bold text-slate-950">
                            {report.report_name}
                          </div>
                        </td>

                        <td className="px-6 py-5 text-slate-600">
                          {report.division ?? "Division TBD"}
                        </td>

                        <td className="px-6 py-5 text-slate-600">
                          {report.team_ids?.length ?? 0}
                        </td>

                        <td className="px-6 py-5 text-slate-600">
                          {formatSavedDate(report.created_at)}
                        </td>

                        <td className="px-6 py-5 text-right">
                          <span className="font-semibold text-purple-700">
                            Open Report →
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}