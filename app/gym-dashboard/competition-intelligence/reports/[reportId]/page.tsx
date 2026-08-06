"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GymDashboardSidebar from "@/app/gym-dashboard/components/GymDashboardSidebar";
import { supabase } from "@/lib/supabaseClient";
import { getActiveGymOrganization } from "@/lib/gym-dashboard/getActiveOrganization";

type TeamProfile = {
  id: string;
  program_id?: string;
  program?: string;
  team?: string;
  name: string;
  division: string | null;
  average: number;
  ceiling: number;
  best?: number;
  best_event?: string | null;
  hit_zero: number;
  events: number;
  avg_event_size_stars?: number;
  avg_event_size_label?: string | null;
  national_percentile?: number;
  trend?: string | null;
  scoringRange?: number;
  averageRank?: number;
  ceilingRank?: number;
  rankImprovement?: number;
};

type EventContextComparison = {
  teamName: string;
  averageRank: number;
  averageGap: number;
  teamEvents: number;
  teamEventSizeStars: number;
  teamEventSizeLabel: string;
  myTeamEvents: number;
  myTeamEventSizeStars: number;
  myTeamEventSizeLabel: string;
  interpretation:
    | "opponent_profile_less_tested"
    | "opponent_profile_more_tested";
  mustMention: boolean;
  contextSummary: string;
};

type ReportSnapshot = {
  version?: number;
  generatedAt?: string;
  myTeamId: string;
  teamIds: string[];
  teams: TeamProfile[];
  fieldSummary: {
    division: string | null;
    fieldSize: number;
    fieldAverage: number;
    fieldType: string;
    fieldCompression: string;
    competitivePosition: string;
    topAverageSpread: number;
    fieldHitZeroAverage: number;
  };
  myTeamPosition: {
    averageRank: number;
    ceilingRank: number;
    consistencyRank: number;
    teamsAboveAverage: number;
    teamsAboveCeiling: number;
    leaderAverageGap: number;
    leaderCeilingGap: number;
  };
  leaders: {
    highestAverageTeam: TeamProfile | null;
    highestCeilingTeam: TeamProfile | null;
    mostConsistentTeam: TeamProfile | null;
    highestUpsideTeam: TeamProfile | null;
    biggestThreat: TeamProfile | null;
    mostVolatileTeam: TeamProfile | null;
    mostStableProfile: TeamProfile | null;
  };
  coachingPriorities: {
    executionPriority: string;
    ceilingPriority: string;
    fieldDepthPriority: string;
    preparationOutlook: string;
  };
  eventContextComparisons?: EventContextComparison[];
};

type AiSnapshot = {
  fieldStoryHeadline?: string;
  fieldStory?: string;
  finalAssessmentHeadline?: string;
  finalAssessment?: string;
};

type SavedReportRow = {
  id: string;
  report_name: string;
  division: string | null;
  created_at: string;
  report_snapshot: ReportSnapshot;
  ai_snapshot: AiSnapshot | null;
};

function formatScore(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

function formatPercent(value: unknown) {
  return `${Math.round(Number(value ?? 0))}%`;
}

export default function SavedCompetitionReportPage() {
  const router = useRouter();
  const params = useParams<{ reportId: string }>();
  const reportId = params?.reportId;

  const [report, setReport] = useState<SavedReportRow | null>(null);
  const [orgName, setOrgName] = useState("Gym Dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSavedReport() {
      setLoading(true);
      setError(null);

      if (!reportId) {
        setError("No saved report was selected.");
        setLoading(false);
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      const userId = session?.user?.id;

      if (sessionError || !userId) {
        setError("Please log in to view this report.");
        setLoading(false);
        return;
      }
let activeOrganization;

try {
  activeOrganization = await getActiveGymOrganization(userId);
} catch (membershipError) {
  console.error(
    "Organization membership lookup failed:",
    membershipError
  );
  setError("Unable to load Gym Dashboard access.");
  setLoading(false);
  return;
}

if (!activeOrganization) {
  setError("No active gym organization was found for this account.");
  setLoading(false);
  return;
}

const organizationId = activeOrganization.organizationId;
const organizationName = activeOrganization.organizationName;

setOrgName(organizationName);

      const { data: reportRow, error: reportError } = await supabase
        .from("competition_reports")
        .select(
          "id, report_name, division, created_at, report_snapshot, ai_snapshot"
        )
        .eq("id", reportId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (reportError) {
        setError(reportError.message);
        setLoading(false);
        return;
      }

      if (!reportRow) {
        setError("This saved report could not be found.");
        setLoading(false);
        return;
      }

      setReport(reportRow as SavedReportRow);
      setLoading(false);
    }

    loadSavedReport();
  }, [reportId]);

  const snapshot = report?.report_snapshot;
  const aiSnapshot = report?.ai_snapshot ?? {};

  const myTeam = useMemo(() => {
    if (!snapshot) return null;

    return (
      snapshot.teams.find((team) => team.id === snapshot.myTeamId) ??
      snapshot.teams[0] ??
      null
    );
  }, [snapshot]);

  const opponents = useMemo(() => {
    if (!snapshot || !myTeam) return [];
    return snapshot.teams.filter((team) => team.id !== myTeam.id);
  }, [snapshot, myTeam]);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full bg-slate-50 text-slate-950">
        <GymDashboardSidebar organizationName={orgName} role="Owner" />

        <main className="ml-64 flex flex-1 items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 font-semibold shadow-sm">
            Loading Saved Report...
          </div>
        </main>
      </div>
    );
  }

  if (error || !report || !snapshot || !myTeam) {
    return (
      <div className="flex min-h-screen w-full bg-slate-50 text-slate-950">
        <GymDashboardSidebar organizationName={orgName} role="Owner" />

        <main className="ml-64 flex flex-1 items-center justify-center p-6">
          <div className="max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700 shadow-sm">
            <div className="font-semibold">
              {error ?? "Unable to load this saved report."}
            </div>

            <button
              onClick={() =>
                router.push(
  "/gym-dashboard/competition-intelligence/reports"
)
              }
              className="mt-4 font-semibold text-purple-700 hover:text-purple-900"
            >
              ← Back to Saved Reports
            </button>
          </div>
        </main>
      </div>
    );
  }

  const { fieldSummary, myTeamPosition, leaders, coachingPriorities } =
    snapshot;

  const savedDate = new Date(report.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-950">
      <GymDashboardSidebar organizationName={orgName} role="Owner" />

      <main className="ml-64 min-w-0 flex-1 overflow-x-hidden p-6 xl:p-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-6 flex items-start justify-between gap-6">
            <div>
              <button
                onClick={() =>
                  router.push(
  "/gym-dashboard/competition-intelligence/reports"
)
                }
                className="mb-4 text-sm font-semibold text-purple-700 hover:text-purple-900"
              >
                ← Back to Saved Reports
              </button>

              <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
                Saved Competition Intelligence Report
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                {report.report_name}
              </h1>

              <p className="mt-1 text-slate-500">
                {myTeam.name} · {report.division ?? "Division TBD"} ·{" "}
                {fieldSummary.fieldSize} teams in field
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Saved {savedDate}
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

          <section className="mb-5 rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
                Executive Summary
              </div>

              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {fieldSummary.competitivePosition}
              </h2>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                {myTeam.name} ranked {myTeamPosition.averageRank} of{" "}
                {fieldSummary.fieldSize} on season average,{" "}
                {myTeamPosition.ceilingRank} of {fieldSummary.fieldSize} on
                scoring ceiling, and {myTeamPosition.consistencyRank} of{" "}
                {fieldSummary.fieldSize} in Hit Zero Rate when this report was
                saved.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard
                label="Field Type"
                value={fieldSummary.fieldType}
                detail="Saved field profile"
              />
              <MetricCard
                label="Your Position"
                value={fieldSummary.competitivePosition}
                detail={`Average rank: ${myTeamPosition.averageRank} of ${fieldSummary.fieldSize}`}
              />
              <MetricCard
                label="Field Average"
                value={formatScore(fieldSummary.fieldAverage)}
                detail={`${fieldSummary.fieldSize}-team selected field`}
              />
              <MetricCard
                label="Highest Average"
                value={formatScore(leaders.highestAverageTeam?.average)}
                detail={leaders.highestAverageTeam?.name ?? "—"}
              />
              <MetricCard
                label="Highest Ceiling"
                value={formatScore(leaders.highestCeilingTeam?.ceiling)}
                detail={leaders.highestCeilingTeam?.name ?? "—"}
              />
              <MetricCard
                label="Most Consistent"
                value={formatPercent(leaders.mostConsistentTeam?.hit_zero)}
                detail={leaders.mostConsistentTeam?.name ?? "—"}
              />
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
                Field Story
              </div>

              <h2 className="mt-2 text-xl font-bold text-slate-950">
                {aiSnapshot.fieldStoryHeadline ||
                  "Saved field analysis"}
              </h2>

              <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-600">
                {aiSnapshot.fieldStory ||
                  "No saved narrative was available for this report."}
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DetailCard
                  label="Scoring Compression"
                  value={fieldSummary.fieldCompression}
                  detail={`Top-team spread: ${formatScore(
                    fieldSummary.topAverageSpread
                  )}`}
                />
                <DetailCard
                  label="Ceiling Pressure"
                  value={`${myTeamPosition.teamsAboveCeiling} opponent${
                    myTeamPosition.teamsAboveCeiling === 1 ? "" : "s"
                  }`}
                  detail="Owned a higher ceiling when saved"
                />
                <DetailCard
                  label="Biggest Threat"
                  value={leaders.biggestThreat?.name ?? "—"}
                  detail={
                    leaders.biggestThreat
                      ? `Average ${formatScore(
                          leaders.biggestThreat.average
                        )} · Ceiling ${formatScore(
                          leaders.biggestThreat.ceiling
                        )}`
                      : "No opponent available"
                  }
                />
                <DetailCard
                  label="Highest Upside"
                  value={leaders.highestUpsideTeam?.name ?? "—"}
                  detail={
                    leaders.highestUpsideTeam
                      ? `${formatScore(
                          Number(leaders.highestUpsideTeam.ceiling) -
                            Number(leaders.highestUpsideTeam.average)
                        )} point scoring range`
                      : "No opponent available"
                  }
                />
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
                Coaching Priorities
              </div>

              <h2 className="mt-2 text-xl font-bold text-slate-950">
                Saved preparation outlook
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <PriorityCard
                  label="Execution and Consistency"
                  value={coachingPriorities.executionPriority}
                  detail={`Consistency rank: ${myTeamPosition.consistencyRank} of ${fieldSummary.fieldSize}`}
                />
                <PriorityCard
                  label="Scoring Upside"
                  value={coachingPriorities.ceilingPriority}
                  detail={`Ceiling rank: ${myTeamPosition.ceilingRank} of ${fieldSummary.fieldSize}`}
                />
                <PriorityCard
                  label="Field Depth"
                  value={coachingPriorities.fieldDepthPriority}
                  detail={`${formatScore(
                    fieldSummary.topAverageSpread
                  )} point top-team spread`}
                />
                <PriorityCard
                  label="Preparation Outlook"
                  value={fieldSummary.competitivePosition}
                  detail={coachingPriorities.preparationOutlook}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
                Primary Competitors
              </div>

              <h2 className="mt-2 text-xl font-bold text-slate-950">
                Saved field leaders and opponent profiles
              </h2>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                <CompetitorRow
                  label="Field Leader"
                  team={leaders.highestAverageTeam}
                />
                <CompetitorRow
                  label="Highest Upside"
                  team={leaders.highestUpsideTeam}
                />
                <CompetitorRow
                  label="Consistency Leader"
                  team={leaders.mostConsistentTeam}
                />
                <CompetitorRow label="Your Team" team={myTeam} emphasized />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
                Complete Field
              </div>

              <h2 className="mt-2 text-xl font-bold text-slate-950">
                Teams captured in this saved report
              </h2>

              <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3">Division</th>
                      <th className="px-4 py-3">Average</th>
                      <th className="px-4 py-3">Ceiling</th>
                      <th className="px-4 py-3">Hit Zero</th>
                      <th className="px-4 py-3">Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.teams.map((team) => (
                      <tr
                        key={team.id}
                        className={`border-b border-slate-100 ${
                          team.id === myTeam.id ? "bg-purple-50" : "bg-white"
                        }`}
                      >
                        <td className="px-4 py-4 font-semibold text-slate-950">
                          {team.name}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {team.division ?? "Division TBD"}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {formatScore(team.average)}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {formatScore(team.ceiling)}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {formatPercent(team.hit_zero)}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {Number(team.events ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
                Final Assessment
              </div>

              <h2 className="mt-2 text-xl font-bold text-slate-950">
                {aiSnapshot.finalAssessmentHeadline ||
                  "Saved competitive assessment"}
              </h2>

              <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-600">
                {aiSnapshot.finalAssessment ||
                  "No saved final assessment was available for this report."}
              </p>
            </section>
          </section>
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-xl font-bold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function DetailCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-lg font-bold text-slate-950">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
    </div>
  );
}

function PriorityCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
        {label}
      </div>
      <div className="mt-2 text-xl font-bold text-slate-950">{value}</div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

function CompetitorRow({
  label,
  team,
  emphasized = false,
}: {
  label: string;
  team: TeamProfile | null;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`grid gap-4 border-b border-slate-200 p-4 md:grid-cols-[180px_1fr_auto] md:items-center ${
        emphasized ? "bg-purple-50" : "bg-white"
      }`}
    >
      <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
        {label}
      </div>

      <div>
        <div className="font-bold text-slate-950">{team?.name ?? "—"}</div>
        <div className="mt-1 text-sm text-slate-500">
          {team?.division ?? "Division TBD"}
        </div>
      </div>

      <div className="flex gap-5 text-sm md:text-right">
        <div>
          <div className="text-xs uppercase text-slate-400">Average</div>
          <div className="font-bold text-slate-950">
            {team ? formatScore(team.average) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-slate-400">Ceiling</div>
          <div className="font-bold text-slate-950">
            {team ? formatScore(team.ceiling) : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-slate-400">HZR</div>
          <div className="font-bold text-slate-950">
            {team ? formatPercent(team.hit_zero) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
