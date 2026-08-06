"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GymDashboardSidebar from "@/app/gym-dashboard/components/GymDashboardSidebar";
import { supabase } from "@/lib/supabaseClient";

type TeamProfile = {
  id: string;
  program_id: string;
  program: string;
  team: string;
  name: string;
  division: string | null;
  average: number;
  ceiling: number;
  best: number;
  best_event: string | null;
  hit_zero: number;
  events: number;
  avg_event_size_stars: number;
  avg_event_size_label: string | null;
  national_percentile: number;
  trend: string | null;
};

export default function CompetitionIntelligenceReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const organizationId = searchParams.get("organizationId");
const myTeamId = searchParams.get("myTeamId");

const [organizationName, setOrganizationName] =
  useState("Gym Dashboard");
  const teamIds = useMemo(() => {
    return (searchParams.get("teamIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }, [searchParams]);

  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldStoryHeadline, setFieldStoryHeadline] = useState("");
  const [fieldStory, setFieldStory] = useState("");
  const [finalHeadline, setFinalHeadline] = useState("");
  const [finalAssessment, setFinalAssessment] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [savingReport, setSavingReport] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [saveReportError, setSaveReportError] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [reportName, setReportName] = useState("");
  const generatedReportKeyRef = useRef<string | null>(null);
  useEffect(() => {
    async function loadReportTeams() {
      setLoading(true);
      setError(null);

      if (!organizationId || !myTeamId || teamIds.length === 0) {
  setError(
    "No organization or competition field was provided for this report."
  );
  setLoading(false);
  return;
}
const {
  data: { user },
  error: userError,
} = await supabase.auth.getUser();

if (userError || !user) {
  setError("Please log in to view this report.");
  setLoading(false);
  return;
}

const { data: membership, error: membershipError } = await supabase
  .from("organization_users")
  .select(`
    organization_id,
    organizations (
      id,
      name,
      subscription_status
    )
  `)
  .eq("user_id", user.id)
  .eq("organization_id", organizationId)
  .maybeSingle();

if (membershipError) {
  setError(membershipError.message);
  setLoading(false);
  return;
}

const organization = Array.isArray(membership?.organizations)
  ? membership.organizations[0]
  : membership?.organizations;

if (!membership || organization?.subscription_status !== "active") {
  setError("Gym Dashboard access is not active for this organization.");
  setLoading(false);
  return;
}

setOrganizationName(organization.name ?? "Gym Dashboard");
      const { data, error: teamError } = await supabase
        .from("v_competition_intelligence_team_profiles")
        .select(
          "id, program_id, program, team, name, division, average, ceiling, best, best_event, hit_zero, events, avg_event_size_stars, avg_event_size_label, national_percentile, trend"
        )
        .in("id", teamIds);

      if (teamError) {
        setError(teamError.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as TeamProfile[];

      // Preserve the same order passed from the field builder.
      const rowMap = new Map(rows.map((team) => [team.id, team]));

      const orderedTeams = teamIds
        .map((id) => rowMap.get(id))
        .filter((team): team is TeamProfile => Boolean(team));

      setTeams(orderedTeams);
      setLoading(false);
    }

    loadReportTeams();
  }, [organizationId, myTeamId, teamIds]);

  const myTeam =
    teams.find((team) => team.id === myTeamId) ?? teams[0];

  const highestAverageTeam = useMemo(() => {
    return [...teams].sort(
      (a, b) => Number(b.average) - Number(a.average)
    )[0];
  }, [teams]);

  const highestCeilingTeam = useMemo(() => {
    return [...teams].sort(
      (a, b) => Number(b.ceiling) - Number(a.ceiling)
    )[0];
  }, [teams]);


  const fieldAverage =
    teams.reduce((sum, team) => sum + Number(team.average ?? 0), 0) /
    Math.max(teams.length, 1);
const opponents = teams.filter((team) => team.id !== myTeamId);

const averageRank =
  [...teams]
    .sort((a, b) => Number(b.average) - Number(a.average))
    .findIndex((team) => team.id === myTeamId) + 1;

const ceilingRank =
  [...teams]
    .sort((a, b) => Number(b.ceiling) - Number(a.ceiling))
    .findIndex((team) => team.id === myTeamId) + 1;

const consistencyRank =
  [...teams]
    .sort((a, b) => Number(b.hit_zero) - Number(a.hit_zero))
    .findIndex((team) => team.id === myTeamId) + 1;

const teamsAboveMyAverage = opponents.filter(
  (team) => Number(team.average) > Number(myTeam?.average ?? 0)
);

const teamsAboveMyCeiling = opponents.filter(
  (team) => Number(team.ceiling) > Number(myTeam?.ceiling ?? 0)
);

const averageSortedTeams = [...teams].sort(
  (a, b) => Number(b.average) - Number(a.average)
);

const topFieldTeams = averageSortedTeams.slice(0, Math.min(5, teams.length));

const topAverageSpread =
  topFieldTeams.length > 1
    ? Number(topFieldTeams[0].average) -
      Number(topFieldTeams[topFieldTeams.length - 1].average)
    : 0;
const maxEventsInField = Math.max(
  ...teams.map((team) => Number(team.events ?? 0)),
  0
);

const earlySeasonField = maxEventsInField <= 2;
const scoringRanges = teams.map((team) => ({
  ...team,
  scoringRange: Number(team.ceiling) - Number(team.average),
}));

const mostVolatileTeam = [...scoringRanges].sort(
  (a, b) => b.scoringRange - a.scoringRange
)[0];

const mostStableProfile = [...scoringRanges].sort(
  (a, b) => a.scoringRange - b.scoringRange
)[0];
const consistencyCandidates = earlySeasonField
  ? teams
  : teams.filter((team) => Number(team.events ?? 0) >= 2);

const mostConsistentTeam =
  [...consistencyCandidates].sort(
    (a, b) =>
      Number(b.hit_zero) - Number(a.hit_zero) ||
      Number(b.events) - Number(a.events)
  )[0] ?? null;

const consistencyContext = mostConsistentTeam
  ? earlySeasonField
    ? `${mostConsistentTeam.name} currently owns the highest Hit Zero Rate, but the field is still early in the season and consistency profiles remain lightly established.`
    : `${mostConsistentTeam.name} owns the strongest Hit Zero profile among teams with enough season history for the comparison to carry weight.`
  : "No consistency leader is currently available.";
const biggestThreat = [...opponents].sort((a, b) => {
  const scoreA =
    Number(a.average) +
    Number(a.ceiling) +
    Number(a.hit_zero) / 100;

  const scoreB =
    Number(b.average) +
    Number(b.ceiling) +
    Number(b.hit_zero) / 100;

  return scoreB - scoreA;
})[0];

const teamsWithRanks = teams.map((team) => {
  const teamAverage = Number(team.average ?? 0);
  const teamCeiling = Number(team.ceiling ?? 0);

  const teamAverageRank =
    teams.filter(
      (otherTeam) =>
        Number(otherTeam.average ?? 0) > teamAverage
    ).length + 1;

  const teamCeilingRank =
    teams.filter(
      (otherTeam) =>
        Number(otherTeam.ceiling ?? 0) > teamCeiling
    ).length + 1;

  return {
    ...team,
    scoringRange: teamCeiling - teamAverage,
    averageRank: teamAverageRank,
    ceilingRank: teamCeilingRank,
    rankImprovement: teamAverageRank - teamCeilingRank,
  };
});

const highestUpsideCandidates = teamsWithRanks.filter((team) => {
  const ceilingIsFieldRelevant =
    team.ceilingRank <= Math.ceil(teams.length / 2);

  const ceilingImprovesPosition =
    team.rankImprovement >= 1;

  const sampleIsUsable =
    earlySeasonField || Number(team.events ?? 0) >= 2;

  return (
    team.id !== myTeamId &&
    ceilingIsFieldRelevant &&
    ceilingImprovesPosition &&
    sampleIsUsable
  );
});

const highestUpsideTeam =
  [...highestUpsideCandidates].sort(
    (a, b) =>
      b.rankImprovement - a.rankImprovement ||
      Number(b.ceiling) - Number(a.ceiling)
  )[0] ?? null;

const upsideContext = highestUpsideTeam
  ? earlySeasonField
    ? `${highestUpsideTeam.name} shows the strongest early upside signal in this field, although the available season history remains limited.`
    : `${highestUpsideTeam.name} ranks ${highestUpsideTeam.averageRank} on average but ${highestUpsideTeam.ceilingRank} on ceiling, giving the team a field-relevant opportunity to outperform its current scoring position.`
  : "No opponent currently shows a meaningful field-relevant upside profile.";

const fieldCompression =
  topAverageSpread <= 0.5
    ? "High"
    : topAverageSpread <= 1
    ? "Moderate"
    : "Low";

const fieldType =
  fieldCompression === "High"
    ? "Compressed Field"
    : teamsAboveMyCeiling.length >= Math.ceil(opponents.length / 2)
    ? "High-Ceiling Field"
    : "Separated Field";

const competitivePosition =
  averageRank === 1
    ? "Field Leader"
    : averageRank <= 3
    ? "Top Contender"
    : averageRank <= Math.ceil(teams.length / 2)
    ? "In the Competitive Mix"
    : "Chasing the Leaders";
const executionPriority =
  consistencyRank > averageRank
    ? "Primary Opportunity"
    : consistencyRank <= 3
    ? "Current Strength"
    : "Monitor";

const ceilingPriority =
  ceilingRank > averageRank
    ? "Development Opportunity"
    : ceilingRank <= 3
    ? "Current Strength"
    : "Competitive";

const fieldDepthPriority =
  fieldCompression === "High"
    ? "Placement-Sensitive"
    : fieldCompression === "Moderate"
    ? "Competitive"
    : "Separated";

const preparationOutlook =
  averageRank <= 3 && consistencyRank <= 3
    ? "Protect an established competitive profile"
    : averageRank <= 3
    ? "Consistency offers the clearest opportunity"
    : ceilingRank <= 3
    ? "Converting upside into repeatable performance matters most"
    : "Multiple areas must improve to close the current field gap";

const fieldHitZeroAverage =
  teams.reduce(
    (sum, team) => sum + Number(team.hit_zero ?? 0),
    0
  ) / Math.max(teams.length, 1);

const leaderAverageGap =
  Number(highestAverageTeam?.average ?? 0) -
  Number(myTeam?.average ?? 0);

const leaderCeilingGap =
  Number(highestCeilingTeam?.ceiling ?? 0) -
  Number(myTeam?.ceiling ?? 0);
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

const teamsRankedAboveMyAverage = averageSortedTeams.filter(
  (team) =>
    team.id !== myTeamId &&
    Number(team.average) > Number(myTeam?.average ?? 0)
);

const eventContextComparisons: EventContextComparison[] =
  myTeam
    ? teamsRankedAboveMyAverage
        .map<EventContextComparison | null>((team) => {
          const averageRankForTeam =
            averageSortedTeams.findIndex(
              (rankedTeam) => rankedTeam.id === team.id
            ) + 1;

          const averageGap =
            Number(team.average) - Number(myTeam.average);

          const teamStars = Number(team.avg_event_size_stars ?? 0);
          const myTeamStars = Number(
            myTeam.avg_event_size_stars ?? 0
          );

          const starDifference = teamStars - myTeamStars;

          const isFieldLeader =
            team.id === highestAverageTeam?.id;

          /*
            Event context is material when:

            1. A team ranked above My Team has an average event-size
               difference of at least two stars; and

            2. Either:
               - the scoring gap is 0.75 or smaller, meaning the teams
                 are close enough for context to affect interpretation; or
               - the team is the field leader but has competed against
                 meaningfully smaller average fields.
          */
          const opponentEvents = Number(team.events ?? 0);
const myTeamEvents = Number(myTeam.events ?? 0);

const closeScoreWithDifferentContext =
  Math.abs(starDifference) >= 2 &&
  averageGap <= 0.75;

const smallerFieldLeaderContext =
  isFieldLeader &&
  starDifference <= -2;

const limitedLeaderSampleContext =
  isFieldLeader &&
  opponentEvents <= 2 &&
  myTeamEvents >= 4 &&
  teamStars < myTeamStars;

const materiallyDifferentEventContext =
  closeScoreWithDifferentContext ||
  smallerFieldLeaderContext ||
  limitedLeaderSampleContext;

          if (!materiallyDifferentEventContext) {
            return null;
          }

          return {
  teamName: team.name,
  averageRank: averageRankForTeam,
  averageGap,

  teamEvents: opponentEvents,
  teamEventSizeStars: teamStars,
  teamEventSizeLabel:
    team.avg_event_size_label ?? "Unknown",

  myTeamEvents,
  myTeamEventSizeStars: myTeamStars,
  myTeamEventSizeLabel:
    myTeam.avg_event_size_label ?? "Unknown",

  interpretation:
    starDifference < 0
      ? "opponent_profile_less_tested"
      : "opponent_profile_more_tested",

  mustMention: true,

  contextSummary:
    starDifference < 0
      ? `${team.name} currently ranks above ${myTeam.name}, but its average is based on ${opponentEvents} event${
          opponentEvents === 1 ? "" : "s"
        } with a ${
          team.avg_event_size_label ?? "smaller"
        } average field size, compared with ${myTeamEvents} event${
          myTeamEvents === 1 ? "" : "s"
        } and a ${
          myTeam.avg_event_size_label ?? "larger"
        } average field size for ${myTeam.name}.`
      : `${team.name} currently ranks above ${myTeam.name}, and its scoring profile is supported by larger average competition fields.`,
} satisfies EventContextComparison;
})
.filter(
  (
    comparison
  ): comparison is EventContextComparison =>
    comparison !== null
)
.slice(0, 3)
: [];

  useEffect(() => {
  if (loading || error || !myTeam || teams.length === 0) return;

  const generationKey = `${myTeam.id}:${teams
    .map((team) => team.id)
    .sort()
    .join(",")}`;

  if (generatedReportKeyRef.current === generationKey) {
    return;
  }

  generatedReportKeyRef.current = generationKey;

  

  async function generateNarrative() {
    try {
      setAiLoading(true);
      setAiError(null);

      const response = await fetch(
        "/api/competition-intelligence/report",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            teamName: myTeam.name,
            division: myTeam.division,
            fieldSize: teams.length,
            fieldType,
            fieldCompression,
            competitivePosition,
            averageRank,
            ceilingRank,
            consistencyRank,
            topAverageSpread,
            teamsAboveAverage: teamsAboveMyAverage.length,
            teamsAboveCeiling: teamsAboveMyCeiling.length,
            fieldHitZeroAverage,
            leaderAverageGap,
            leaderCeilingGap,

            fieldLeader: highestAverageTeam
              ? {
                  name: highestAverageTeam.name,
                  average: Number(highestAverageTeam.average),
                  ceiling: Number(highestAverageTeam.ceiling),
                  hitZero: Number(highestAverageTeam.hit_zero),
                }
              : null,

            highestUpsideTeam: highestUpsideTeam
              ? {
                  name: highestUpsideTeam.name,
                  average: Number(highestUpsideTeam.average),
                  ceiling: Number(highestUpsideTeam.ceiling),
                  scoringRange: Number(
                    highestUpsideTeam.ceiling
                  ) - Number(highestUpsideTeam.average),
                }
              : null,

            consistencyLeader: mostConsistentTeam
              ? {
                  name: mostConsistentTeam.name,
                  hitZero: Number(mostConsistentTeam.hit_zero),
                  events: Number(mostConsistentTeam.events),
                }
              : null,
              eventContextComparisons,
          }),
        }
      );

      const responseText = await response.text();

let result: {
  fieldStoryHeadline?: string;
  fieldStory?: string;
  finalAssessmentHeadline?: string;
  finalAssessment?: string;
  error?: string;
};

try {
  result = JSON.parse(responseText);
} catch {
  console.error("Non-JSON API response:", responseText);

  throw new Error(
    `Report API returned ${response.status} ${response.statusText}. Check the Next.js terminal for the server error.`
  );
}

if (!response.ok) {
  throw new Error(
    result.error ?? "Unable to generate the report narrative."
  );
}

     

      setFieldStoryHeadline(result.fieldStoryHeadline ?? "");
      setFieldStory(result.fieldStory ?? "");
      setFinalHeadline(result.finalAssessmentHeadline ?? "");
      setFinalAssessment(result.finalAssessment ?? "");
    } catch (requestError) {
      

      console.error(
        "Competition narrative generation failed:",
        requestError
      );

      setAiError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate the report narrative."
      );
    } finally {
  setAiLoading(false);
}
  }

  generateNarrative();
}, [loading, error, myTeamId, teams]);

async function handleSaveReport() {
  if (!myTeam || teams.length === 0) {
    setSaveReportError("The report is not ready to save.");
    return;
  }

  if (!reportName.trim()) {
    setSaveReportError("Enter a report name.");
    return;
  }

  try {
    setSavingReport(true);
    setSaveReportError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("You must be signed in to save this report.");
    }

    if (!organizationId) {
  throw new Error(
    "No Gym Dashboard organization was provided for this report."
  );
}

    const generatedAt = new Date().toISOString();

    const reportSnapshot = {
      version: 1,
      generatedAt,

      myTeamId: myTeam.id,
      teamIds: teams.map((team) => team.id),
      teams,

      fieldSummary: {
        division: myTeam.division,
        fieldSize: teams.length,
        fieldAverage,
        fieldType,
        fieldCompression,
        competitivePosition,
        topAverageSpread,
        fieldHitZeroAverage,
      },

      myTeamPosition: {
        averageRank,
        ceilingRank,
        consistencyRank,
        teamsAboveAverage: teamsAboveMyAverage.length,
        teamsAboveCeiling: teamsAboveMyCeiling.length,
        leaderAverageGap,
        leaderCeilingGap,
      },

      leaders: {
        highestAverageTeam: highestAverageTeam ?? null,
        highestCeilingTeam: highestCeilingTeam ?? null,
        mostConsistentTeam: mostConsistentTeam ?? null,
        highestUpsideTeam: highestUpsideTeam ?? null,
        biggestThreat: biggestThreat ?? null,
        mostVolatileTeam: mostVolatileTeam ?? null,
        mostStableProfile: mostStableProfile ?? null,
      },

      coachingPriorities: {
        executionPriority,
        ceilingPriority,
        fieldDepthPriority,
        preparationOutlook,
      },

      eventContextComparisons,
    };

    const aiSnapshot = {
      fieldStoryHeadline,
      fieldStory,
      finalAssessmentHeadline: finalHeadline,
      finalAssessment,
    };

    const { data: savedReport, error: insertError } = await supabase
      .from("competition_reports")
      .insert({
        organization_id: organizationId,
        competition_field_id: null,
        my_team_id: myTeam.id,
        created_by: user.id,
        report_name: reportName.trim(),
        division: myTeam.division,
        team_ids: teams.map((team) => team.id),
        report_snapshot: reportSnapshot,
        ai_snapshot: aiSnapshot,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    setSavedReportId(savedReport.id);
    setShowSaveDialog(false);
  } catch (saveError) {
    console.error("Competition report save failed:", saveError);

    setSaveReportError(
      saveError instanceof Error
        ? saveError.message
        : "Unable to save this report."
    );
  } finally {
    setSavingReport(false);
  }
}

  if (loading) {
    return (
      <div className="flex min-h-screen w-full bg-slate-50 text-slate-950">
        <GymDashboardSidebar
          organizationName="Gym Dashboard"
          role="Owner"
        />

        <main className="ml-64 flex flex-1 items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 font-semibold shadow-sm">
            Loading Competition Intelligence Report...
          </div>
        </main>
      </div>
    );
  }

  if (error || !myTeam) {
    return (
      <div className="flex min-h-screen w-full bg-slate-50 text-slate-950">
        <GymDashboardSidebar
          organizationName="Gym Dashboard"
          role="Owner"
        />

        <main className="ml-64 flex flex-1 items-center justify-center">
          <div className="rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700 shadow-sm">
            {error ?? "Unable to load the selected competition field."}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-950">
      <GymDashboardSidebar
  organizationName={organizationName}
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
                Competition Intelligence Report
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                {myTeam.name}
              </h1>

              <p className="mt-1 text-slate-500">
                {myTeam.division ?? "Division TBD"} · {teams.length} teams in
                field
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Generated {new Date().toLocaleDateString()}
              </p>
            </div>

            <div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSaveReportError(null);
                    setShowSaveDialog(true);
                  }}
                  disabled={
                    savingReport ||
                    aiLoading ||
                    Boolean(savedReportId)
                  }
                  className={`rounded-xl border px-4 py-2 font-semibold shadow-sm transition ${
                    savedReportId
                      ? "cursor-default border-emerald-200 bg-emerald-50 text-emerald-700"
                      : savingReport || aiLoading
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : "border-purple-200 bg-white text-purple-700 hover:border-purple-300 hover:bg-purple-50"
                  }`}
                >
                  {savedReportId
                    ? "Report Saved"
                    : savingReport
                    ? "Saving..."
                    : aiLoading
                    ? "Finishing Report..."
                    : "Save Report"}
                </button>

                <button
                  disabled
                  className="cursor-not-allowed rounded-xl bg-slate-200 px-4 py-2 font-semibold text-slate-400 shadow-sm"
                >
                  Export PDF
                </button>
              </div>

              {saveReportError && (
                <div className="mt-2 text-right text-xs font-semibold text-red-600">
                  {saveReportError}
                </div>
              )}
            </div>
          </div>

          <section className="mb-5 rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
                Executive Summary
              </div>

              <h2 className="mt-2 text-2xl font-bold text-slate-950">
  {competitivePosition}
</h2>

<p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
  {myTeam.name} ranks {averageRank} of {teams.length} on season average,
  {` ${ceilingRank} of ${teams.length}`} on scoring ceiling, and
  {` ${consistencyRank} of ${teams.length}`} in Hit Zero Rate.
  This field currently profiles as a {fieldType.toLowerCase()} with
  {` ${fieldCompression.toLowerCase()}`} compression among the top teams.
</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
  <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
    <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
      Field Type
    </div>

    <div className="mt-2 text-xl font-bold text-slate-950">
      {fieldType}
    </div>

    <div className="mt-1 text-xs text-slate-500">
      Based on compression and ceiling pressure
    </div>
  </div>

  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
    <div className="text-xs font-bold uppercase tracking-wide text-indigo-700">
      Your Position
    </div>

    <div className="mt-2 text-xl font-bold text-slate-950">
      {competitivePosition}
    </div>

    <div className="mt-1 text-xs text-slate-500">
      Average rank: {averageRank} of {teams.length}
    </div>
  </div>

  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
      Field Average
    </div>

    <div className="mt-2 text-3xl font-bold text-slate-950">
      {fieldAverage.toFixed(2)}
    </div>

    <div className="mt-1 text-xs text-slate-500">
      {teams.length}-team selected field
    </div>
  </div>

  <div className="rounded-xl border border-slate-200 bg-amber-50 p-5">
    <div className="text-xs font-bold uppercase tracking-wide text-amber-700">
      Highest Average
    </div>

    <div className="mt-2 text-3xl font-bold text-slate-950">
      {Number(highestAverageTeam?.average ?? 0).toFixed(2)}
    </div>

    <div className="mt-1 text-xs font-semibold text-slate-600">
      {highestAverageTeam?.name ?? "—"}
    </div>
  </div>

  <div className="rounded-xl border border-slate-200 bg-orange-50 p-5">
    <div className="text-xs font-bold uppercase tracking-wide text-orange-700">
      Highest Ceiling
    </div>

    <div className="mt-2 text-3xl font-bold text-slate-950">
      {Number(highestCeilingTeam?.ceiling ?? 0).toFixed(2)}
    </div>

    <div className="mt-1 text-xs font-semibold text-slate-600">
      {highestCeilingTeam?.name ?? "—"}
    </div>
  </div>

  <div className="rounded-xl border border-slate-200 bg-blue-50 p-5">
    <div className="text-xs font-bold uppercase tracking-wide text-blue-700">
      Most Consistent
    </div>

    <div className="mt-2 text-3xl font-bold text-slate-950">
      {Math.round(Number(mostConsistentTeam?.hit_zero ?? 0))}%
    </div>

    <div className="mt-1 text-xs font-semibold text-slate-600">
      {mostConsistentTeam?.name ?? "—"}
    </div>
  </div>
</div>
          </section>

          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
    Field Story
  </div>

  <h2 className="mt-2 text-xl font-bold text-slate-950">
  {aiLoading
    ? "Generating field story..."
    : fieldStoryHeadline ||
      (fieldCompression === "High"
        ? "The top of this field is tightly compressed."
        : fieldType === "High-Ceiling Field"
        ? "Ceiling pressure creates meaningful movement potential."
        : "The field shows clear separation among the leading teams.")}
</h2>

  <p className="mt-3 text-sm leading-6 text-slate-600">
  {aiLoading
    ? "Analyzing the selected field..."
    : fieldStory ||
      "The narrative could not be generated. The structured field facts remain available below."}
</p>

{aiError && (
  <p className="mt-2 text-xs font-semibold text-red-600">
    {aiError}
  </p>
)}

  <div className="mt-5 grid gap-3 sm:grid-cols-2">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Scoring Compression
      </div>

      <div className="mt-2 text-lg font-bold text-slate-950">
        {fieldCompression}
      </div>

      <div className="mt-1 text-xs leading-5 text-slate-500">
        The top {topFieldTeams.length} teams are separated by{" "}
        {topAverageSpread.toFixed(2)} points on season average.
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Ceiling Pressure
      </div>

      <div className="mt-2 text-lg font-bold text-slate-950">
        {teamsAboveMyCeiling.length} opponent
        {teamsAboveMyCeiling.length === 1 ? "" : "s"}
      </div>

      <div className="mt-1 text-xs leading-5 text-slate-500">
        Currently own a higher scoring ceiling than {myTeam.team}.
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Biggest Threat
      </div>

      <div className="mt-2 text-lg font-bold text-slate-950">
        {biggestThreat?.name ?? "No opponent selected"}
      </div>

      <div className="mt-1 text-xs leading-5 text-slate-500">
        {biggestThreat
          ? `Average ${Number(biggestThreat.average).toFixed(
              2
            )} · Ceiling ${Number(biggestThreat.ceiling).toFixed(
              2
            )} · HZR ${Math.round(Number(biggestThreat.hit_zero))}%`
          : "Add opponents to identify the strongest combined profile."}
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Highest Upside
      </div>

      <div className="mt-2 text-lg font-bold text-slate-950">
        {highestUpsideTeam?.name ?? "No opponent selected"}
      </div>

      <div className="mt-1 text-xs leading-5 text-slate-500">
        {highestUpsideTeam
          ? `${(
              Number(highestUpsideTeam.ceiling) -
              Number(highestUpsideTeam.average)
            ).toFixed(2)} points between average and ceiling.`
          : "Add opponents to identify the largest scoring range."}
      </div>
    </div>
  </div>

  
</div>
<section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
    Coaching Priorities
  </div>

  <h2 className="mt-2 text-xl font-bold text-slate-950">
    Where the data suggests the greatest preparation opportunity
  </h2>

  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
    These priorities compare your team&apos;s current position across average,
    ceiling, and consistency. They identify where improvement could have the
    greatest effect on your competitive outlook without predicting an exact
    score or placement.
  </p>

  <div className="mt-5 grid gap-4 md:grid-cols-2">
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-blue-700">
            Execution and Consistency
          </div>

          <div className="mt-2 text-xl font-bold text-slate-950">
            {executionPriority}
          </div>
        </div>

        <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700">
          {consistencyRank} of {teams.length}
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {consistencyRank > averageRank
          ? `Your season average ranks ${averageRank} of ${teams.length}, while your Hit Zero Rate ranks ${consistencyRank}. Improving repeatability represents a clearer opportunity than your average position alone suggests.`
          : `Your Hit Zero Rate ranks ${consistencyRank} of ${teams.length}, supporting your current competitive position and reducing reliance on opponent mistakes.`}
      </p>
    </div>

    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-amber-700">
            Scoring Upside
          </div>

          <div className="mt-2 text-xl font-bold text-slate-950">
            {ceilingPriority}
          </div>
        </div>

        <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-700">
          {ceilingRank} of {teams.length}
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {teamsAboveMyCeiling.length > 0
          ? `${teamsAboveMyCeiling.length} opponent${
              teamsAboveMyCeiling.length === 1 ? "" : "s"
            } currently own a higher ceiling. Your ceiling remains competitive, but there is measurable upside pressure within this field.`
          : "No selected opponent currently owns a higher scoring ceiling, making your existing upside one of the strongest profiles in the field."}
      </p>
    </div>

    <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
            Field Depth
          </div>

          <div className="mt-2 text-xl font-bold text-slate-950">
            {fieldDepthPriority}
          </div>
        </div>

        <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-purple-700">
          {topAverageSpread.toFixed(2)} spread
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        The top {topFieldTeams.length} teams are separated by{" "}
        {topAverageSpread.toFixed(2)} points on season average.{" "}
        {fieldCompression === "High"
          ? "Small performance changes may materially alter the expected order."
          : fieldCompression === "Moderate"
          ? "The field remains competitive, but some separation has begun to form."
          : "The leading profiles currently show meaningful separation from the rest of the field."}
      </p>
    </div>

    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">
        Preparation Outlook
      </div>

      <div className="mt-2 text-xl font-bold text-slate-950">
        {competitivePosition}
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {preparationOutlook}. This conclusion is based on your relative average,
        ceiling, and consistency positions within the selected field.
      </p>
    </div>
  </div>
</section>
            
<section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
    Primary Competitors
  </div>

  <h2 className="mt-2 text-xl font-bold text-slate-950">
    Teams most likely to influence your preparation
  </h2>

  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
    These opponents stand out because of their established scoring position,
    consistency, or ability to outperform their current average.
  </p>

  <div className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200">
    <div className="grid gap-4 p-4 md:grid-cols-[180px_1fr_auto] md:items-center">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
          Field Leader
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Current benchmark
        </div>
      </div>

      <div>
        <div className="font-bold text-slate-950">
          {highestAverageTeam?.name ?? "—"}
        </div>
        <div className="mt-1 text-sm text-slate-500">
          {highestAverageTeam?.division ?? "Division TBD"}
        </div>
        <div className="mt-2 text-sm leading-6 text-slate-600">
          Owns the highest season average in the selected field and establishes
          the current competitive standard.
        </div>
      </div>

      <div className="flex gap-5 text-sm md:text-right">
        <div>
          <div className="text-xs uppercase text-slate-400">Average</div>
          <div className="font-bold text-slate-950">
            {Number(highestAverageTeam?.average ?? 0).toFixed(2)}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase text-slate-400">Ceiling</div>
          <div className="font-bold text-slate-950">
            {Number(highestAverageTeam?.ceiling ?? 0).toFixed(2)}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase text-slate-400">HZR</div>
          <div className="font-bold text-slate-950">
            {Math.round(Number(highestAverageTeam?.hit_zero ?? 0))}%
          </div>
        </div>
      </div>
    </div>

    <div className="grid gap-4 p-4 md:grid-cols-[180px_1fr_auto] md:items-center">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-amber-700">
          Highest Upside
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Movement potential
        </div>
      </div>

      <div>
        <div className="font-bold text-slate-950">
          {highestUpsideTeam?.name ?? "—"}
        </div>
        <div className="mt-1 text-sm text-slate-500">
          {highestUpsideTeam?.division ?? "Division TBD"}
        </div>
        <div className="mt-2 text-sm leading-6 text-slate-600">
  {upsideContext}
</div>
      </div>

      <div className="flex gap-5 text-sm md:text-right">
        <div>
          <div className="text-xs uppercase text-slate-400">Average</div>
          <div className="font-bold text-slate-950">
            {highestUpsideTeam
  ? Number(highestUpsideTeam.average).toFixed(2)
  : "—"}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase text-slate-400">Ceiling</div>
          <div className="font-bold text-slate-950">
            {highestUpsideTeam
  ? Number(highestUpsideTeam.ceiling).toFixed(2)
  : "—"}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase text-slate-400">Range</div>
          <div className="font-bold text-slate-950">
            {highestUpsideTeam
              ? (
                  Number(highestUpsideTeam.ceiling) -
                  Number(highestUpsideTeam.average)
                ).toFixed(2)
              : "—"}
          </div>
        </div>
      </div>
    </div>

    <div className="grid gap-4 p-4 md:grid-cols-[180px_1fr_auto] md:items-center">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-blue-700">
          Consistency Leader
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Reliable execution
        </div>
      </div>

      <div>
        <div className="font-bold text-slate-950">
          {mostConsistentTeam?.name ?? "—"}
        </div>
        <div className="mt-1 text-sm text-slate-500">
          {mostConsistentTeam?.division ?? "Division TBD"}
        </div>
        <div className="mt-2 text-sm leading-6 text-slate-600">
  {consistencyContext}
</div>
      </div>

      <div className="flex gap-5 text-sm md:text-right">
        <div>
          <div className="text-xs uppercase text-slate-400">HZR</div>
          <div className="font-bold text-slate-950">
            {mostConsistentTeam
  ? `${Math.round(Number(mostConsistentTeam.hit_zero))}%`
  : "—"}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase text-slate-400">Average</div>
          <div className="font-bold text-slate-950">
            {mostConsistentTeam
  ? Number(mostConsistentTeam.average).toFixed(2)
  : "—"}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase text-slate-400">Events</div>
          <div className="font-bold text-slate-950">
            {mostConsistentTeam
  ? Number(mostConsistentTeam.events)
  : "—"}
          </div>
        </div>
      </div>
    </div>

    <div className="grid gap-4 bg-blue-50/60 p-4 md:grid-cols-[180px_1fr_auto] md:items-center">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-blue-700">
          Your Team
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Current position
        </div>
      </div>

      <div>
        <div className="font-bold text-slate-950">{myTeam.name}</div>
        <div className="mt-1 text-sm text-slate-500">
          {myTeam.division ?? "Division TBD"}
        </div>
        <div className="mt-2 text-sm leading-6 text-slate-600">
          Currently ranks {averageRank} of {teams.length} on average,{" "}
          {ceilingRank} of {teams.length} on ceiling, and {consistencyRank} of{" "}
          {teams.length} in Hit Zero Rate.
        </div>
      </div>

      <div className="flex gap-5 text-sm md:text-right">
        <div>
          <div className="text-xs uppercase text-slate-400">Average</div>
          <div className="font-bold text-slate-950">
            {Number(myTeam.average).toFixed(2)}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase text-slate-400">Ceiling</div>
          <div className="font-bold text-slate-950">
            {Number(myTeam.ceiling).toFixed(2)}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase text-slate-400">HZR</div>
          <div className="font-bold text-slate-950">
            {Math.round(Number(myTeam.hit_zero))}%
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
    Field Dynamics
  </div>

  <h2 className="mt-2 text-xl font-bold text-slate-950">
    The structure behind the selected field
  </h2>

  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
    These metrics explain how closely grouped the field is, how much scoring
    upside exists, and how your current profile compares with the leaders.
  </p>

  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Top-Five Spread
      </div>

      <div className="mt-2 text-3xl font-bold text-slate-950">
        {topAverageSpread.toFixed(2)}
      </div>

      <div className="mt-1 text-xs leading-5 text-slate-500">
        Difference between the highest and fifth-highest season averages.
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Average Gap to Leader
      </div>

      <div className="mt-2 text-3xl font-bold text-slate-950">
        {Math.max(leaderAverageGap, 0).toFixed(2)}
      </div>

      <div className="mt-1 text-xs leading-5 text-slate-500">
        Current separation between your average and the field leader.
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Ceiling Gap to Leader
      </div>

      <div className="mt-2 text-3xl font-bold text-slate-950">
        {Math.max(leaderCeilingGap, 0).toFixed(2)}
      </div>

      <div className="mt-1 text-xs leading-5 text-slate-500">
        Current separation between your ceiling and the highest ceiling.
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Field Hit Zero Rate
      </div>

      <div className="mt-2 text-3xl font-bold text-slate-950">
        {Math.round(fieldHitZeroAverage)}%
      </div>

      <div className="mt-1 text-xs leading-5 text-slate-500">
        Average Hit Zero Rate across all selected teams.
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Teams Above Your Average
      </div>

      <div className="mt-2 text-3xl font-bold text-slate-950">
        {teamsAboveMyAverage.length}
      </div>

      <div className="mt-1 text-xs leading-5 text-slate-500">
        Opponents currently averaging above your team.
      </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Teams Above Your Ceiling
      </div>

      <div className="mt-2 text-3xl font-bold text-slate-950">
        {teamsAboveMyCeiling.length}
      </div>

      <div className="mt-1 text-xs leading-5 text-slate-500">
        Opponents currently showing greater scoring upside.
      </div>
    </div>

    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-amber-700">
        Widest Scoring Range
      </div>

      <div className="mt-2 text-lg font-bold text-slate-950">
        {mostVolatileTeam?.name ?? "—"}
      </div>

      <div className="mt-1 text-xs leading-5 text-slate-600">
        {mostVolatileTeam
          ? `${mostVolatileTeam.scoringRange.toFixed(
              2
            )} points between average and ceiling.`
          : "—"}
      </div>
    </div>

    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">
        Narrowest Scoring Range
      </div>

      <div className="mt-2 text-lg font-bold text-slate-950">
        {mostStableProfile?.name ?? "—"}
      </div>

      <div className="mt-1 text-xs leading-5 text-slate-600">
        {mostStableProfile
          ? `${mostStableProfile.scoringRange.toFixed(
              2
            )} points between average and ceiling.`
          : "—"}
      </div>
    </div>
  </div>
</section>
<section className="mt-5 rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
  <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
    Final Assessment
  </div>

  <h2 className="mt-2 text-xl font-bold text-slate-950">
  {aiLoading
    ? "Generating final assessment..."
    : finalHeadline || "Competitive assessment unavailable"}
</h2>

<p className="mt-3 max-w-5xl text-sm leading-6 text-slate-600">
  {aiLoading
    ? "Synthesizing the selected field..."
    : finalAssessment ||
      "The assessment could not be generated. Review the deterministic report sections above."}
</p>
</section>
             
          </section>
        </div>
      </main>

      {showSaveDialog && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
              Save Competition Report
            </div>

            <h2 className="mt-2 text-xl font-bold text-slate-950">
              Name this report
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Use the event name, location, or another label that will make this
              report easy to find later.
            </p>

            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Report Name
            </label>

            <input
              type="text"
              value={reportName}
              onChange={(event) => {
                setReportName(event.target.value);
                setSaveReportError(null);
              }}
              autoFocus
              maxLength={120}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
              placeholder="Name this report"
            />

            {saveReportError && (
              <div className="mt-2 text-sm font-semibold text-red-600">
                {saveReportError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveReportError(null);
                }}
                disabled={savingReport}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveReport}
                disabled={savingReport || !reportName.trim()}
                className={`rounded-xl px-4 py-2 font-semibold text-white shadow-sm transition ${
                  savingReport || !reportName.trim()
                    ? "cursor-not-allowed bg-slate-300"
                    : "bg-purple-600 hover:bg-purple-700"
                }`}
              >
                {savingReport ? "Saving..." : "Save Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}