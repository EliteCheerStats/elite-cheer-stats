"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GymDashboardSidebar from "@/app/gym-dashboard/components/GymDashboardSidebar";
import { supabase } from "@/lib/supabaseClient";

const MY_TEAM_ID = "royalty";
type MyTeamOption = {
  team_id: string;
  team: string;
  division: string | null;
  organization_name: string;
};
type Team = {
  id: string;
  programId: string;          // <-- ADD
  name: string;
  location: string;
  division?: string | null;   // <-- ADD
  isMine?: boolean;
  average: number;
  ceiling: number;
  best: number;
  bestEvent: string;
  hitZero: number;
  events: number;
  avgEventSizeStars: number;
  avgEventSizeLabel: string;
  nationalPercentile: number;
  trend: "Rising" | "Fastest Improving" | "Falling" | "Stable";
};
function stars(count: number) {
  return (
    <span className="tracking-tight text-amber-400">
      {"★".repeat(count)}
      <span className="text-slate-300">{"☆".repeat(5 - count)}</span>
    </span>
  );
}

function delta(value: number, suffix = "") {
  const good = value > 0;
  const even = value === 0;

  return (
    <div
      className={`text-xs font-semibold ${
        even ? "text-slate-400" : good ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {even ? "—" : `${good ? "+" : ""}${value.toFixed(suffix === "%" ? 0 : 2)}${suffix}`}
    </div>
  );
}
function ordinal(n: number) {
  const suffix =
    n % 10 === 1 && n % 100 !== 11
      ? "st"
      : n % 10 === 2 && n % 100 !== 12
      ? "nd"
      : n % 10 === 3 && n % 100 !== 13
      ? "rd"
      : "th";

  return `${n}${suffix}`;
}

function getDivisionSize(division?: string | null) {
  const value = division?.toLowerCase() ?? "";

  if (value.includes("x-small") || value.includes("xsmall")) return "xsmall";
  if (value.includes("small")) return "small";
  if (value.includes("medium")) return "medium";
  if (value.includes("large")) return "large";

  return null;
}

function getDivisionCore(division?: string | null) {
  return (division ?? "")
    .replace(/\s*-\s*(x-small|xsmall|small|medium|large)\s*$/i, "")
    .trim()
    .toLowerCase();
}

function getFieldOutlook({
  averageRank,
  ceilingRank,
  hitZeroRank,
  fieldSize,
}: {
  averageRank: number;
  ceilingRank: number;
  hitZeroRank: number;
  fieldSize: number;
}) {
  const avgTopThree = averageRank <= 3;
  const ceilingTopThree = ceilingRank <= 3;
  const hzrTopThree = hitZeroRank <= 3;

  if (averageRank === 1 && ceilingRank === 1) {
    return {
      title: "You enter this field as the team to beat.",
      body: `Your average ranks ${ordinal(averageRank)} of ${fieldSize}, your ceiling ranks ${ordinal(
        ceilingRank
      )}, and your consistency gives you a strong path to win this field.`,
    };
  }

  if (avgTopThree && ceilingTopThree) {
    return {
      title: "You enter this field as a legitimate title contender.",
      body: `Your average ranks ${ordinal(averageRank)} of ${fieldSize}, your ceiling ranks ${ordinal(
        ceilingRank
      )}, and your hit zero rate ranks ${ordinal(hitZeroRank)}. You have a realistic path to gold if you perform clean.`,
    };
  }

  if (avgTopThree || ceilingTopThree || hzrTopThree) {
    return {
      title: "You have a realistic podium path in this field.",
      body: `Your average ranks ${ordinal(averageRank)} of ${fieldSize}, your ceiling ranks ${ordinal(
        ceilingRank
      )}, and your hit zero rate ranks ${ordinal(hitZeroRank)}. A top-three finish is a strong target.`,
    };
  }

  return {
    title: "This looks like a challenging field.",
    body: `Your average ranks ${ordinal(averageRank)} of ${fieldSize}, your ceiling ranks ${ordinal(
      ceilingRank
    )}, and your hit zero rate ranks ${ordinal(hitZeroRank)}. This field may require a season-best performance to break through.`,
  };
}
function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function TeamCompareCard({
  team,
  focused,
  isMine,
}: {
  team: Team;
  focused: Team;
  isMine?: boolean;
}) {
  const showDeltas = isMine;

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        isMine
          ? "border-blue-300 bg-white"
          : "border-purple-300 bg-purple-50/40"
      }`}
    >
      <div
        className={`mb-3 inline-flex rounded-md px-2 py-1 text-[11px] font-bold uppercase text-white ${
          isMine ? "bg-blue-600" : "bg-purple-600"
        }`}
      >
        {isMine ? "Your Team" : "Focused Team"}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-slate-950">
            {team.name} {isMine && <span className="text-sm text-blue-600">(You)</span>}
          </div>
          <div className="text-xs text-slate-500">{team.location}</div>
<div className="text-xs font-semibold text-slate-500">{team.division ?? "Division TBD"}</div>
        </div>

        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          Top {team.nationalPercentile}%
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Metric label="Average Score" value={team.average.toFixed(2)}>
          {showDeltas && delta(team.average - focused.average)}
        </Metric>

        <Metric label="Ceiling Score" value={team.ceiling.toFixed(2)}>
          {showDeltas && delta(team.ceiling - focused.ceiling)}
        </Metric>

        <Metric label="Best Score" value={team.best.toFixed(2)}>
          {showDeltas && delta(team.best - focused.best)}
          <div className="mt-1 text-[11px] leading-tight text-slate-500">
            <div>{stars(team.avgEventSizeStars)}</div>
            <div>{team.bestEvent}</div>
          </div>
        </Metric>

        <Metric label="Hit Zero Rate" value={`${team.hitZero}%`}>
          {showDeltas && delta(team.hitZero - focused.hitZero, "%")}
        </Metric>

        <Metric label="Events" value={team.events}>
          {showDeltas && delta(team.events - focused.events)}
        </Metric>

        <Metric label="Avg Event Size" value={stars(team.avgEventSizeStars)}>
          <div className="text-[11px] text-slate-500">{team.avgEventSizeLabel}</div>
        </Metric>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  children,
}: {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 pb-2">
      <div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-base font-bold text-slate-950">{value}</div>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

function StrengthLandscape({
  teams,
  myTeam,
  myTeamId,
  focusedId,
  setFocusedId,
}: {
  teams: Team[];
  myTeam: Team;
  myTeamId: string;
  focusedId: string;
  setFocusedId: (id: string) => void;
}) {
  const scores = teams.flatMap((team) => [team.average, team.ceiling]);
  const min = Math.floor(Math.min(...scores) - 1);
  const max = Math.ceil(Math.max(...scores) + 1);
  const chartHeight = 300;

  const y = (score: number) =>
    chartHeight - ((score - min) / (max - min)) * chartHeight;

  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);

    const chartWidth = 1460;
const chartLeft = 70;
const chartRight = 40;
const usableWidth = chartWidth - chartLeft - chartRight;
const spacing = teams.length > 1 ? usableWidth / (teams.length - 1) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Strength Landscape</h2>
          <p className="text-sm text-slate-500">
            Each team&apos;s average-to-ceiling range. Click any team to compare.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
          <span className="text-blue-600">● Your Team</span>
          <span className="text-purple-600">● Focused Team</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width={chartWidth} height={420} className="w-full">
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={40}
                x2={chartWidth - chartRight}
                y1={y(tick) + 30}
                y2={y(tick) + 30}
                stroke="#e2e8f0"
              />
              <text x={8} y={y(tick) + 35} fontSize="12" fill="#64748b">
                {tick}
              </text>
            </g>
          ))}

          <line
            x1={40}
            x2={chartWidth - chartRight}
            y1={y(myTeam.average) + 30}
            y2={y(myTeam.average) + 30}
            stroke="#2563eb"
            strokeDasharray="5 5"
          />

          <text x={chartWidth - 180} y={y(myTeam.average) + 22} fontSize="12" fill="#2563eb">
            Your Avg {myTeam.average.toFixed(2)}
          </text>

          {teams.map((team, index) => {
            const x = chartLeft + index * spacing;
            const avgY = y(team.average) + 30;
            const ceilingY = y(team.ceiling) + 30;
            const isFocused = team.id === focusedId;
            const isMine = team.id === myTeamId;

            const accent = isMine ? "#2563eb" : isFocused ? "#9333ea" : "#7c3aed";
            const bg = isMine ? "#dbeafe" : isFocused ? "#f3e8ff" : "transparent";

            return (
              <g
                key={team.id}
                onClick={() => setFocusedId(team.id)}
                className="cursor-pointer"
              >
                {(isMine || isFocused) && (
                  <rect
                    x={x - 42}
                    y={18}
                    width={84}
                    height={345}
                    rx={14}
                    fill={bg}
                  />
                )}

                <line
                  x1={x}
                  x2={x}
                  y1={ceilingY}
                  y2={avgY}
                  stroke={accent}
                  strokeWidth={isMine || isFocused ? "5" : "3"}
                  strokeLinecap="round"
                />

                <circle cx={x} cy={ceilingY} r={5} fill={accent} />
                <circle cx={x} cy={avgY} r={7} fill={accent} />

                <text
                  x={x}
                  y={ceilingY - 10}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill={accent}
                >
                  {team.ceiling.toFixed(2)}
                </text>

                <text
                  x={x}
                  y={avgY + 24}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill={accent}
                >
                  {team.average.toFixed(2)}
                </text>

                {isMine && (
                  <text x={x} y={372} textAnchor="middle" fontSize="16">
                    👑
                  </text>
                )}

                <text
                  x={x}
                  y={392}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight={isMine || isFocused ? "700" : "500"}
                  fill={accent}
                >
                  {team.name.split(" ").slice(-1).join(" ")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        Bottom dot = season average. Top dot = ceiling. Taller ranges show more scoring upside.
      </div>
    </div>
  );
}
type CompetitionProfileRow = {
  id: string;
  program_id: string;
  program: string | null;
  team: string | null;
  name: string | null;
  division: string | null;
  average: number | null;
  ceiling: number | null;
  best: number | null;
  best_event: string | null;
  hit_zero: number | null;
  events: number | null;
  avg_event_size_stars: number | null;
  avg_event_size_label: string | null;
  national_percentile: number | null;
  trend: Team["trend"] | null;
};
export default function CompetitionIntelligencePage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeams, setMyTeams] = useState<MyTeamOption[]>([]);
  const [myTeamId, setMyTeamId] = useState(MY_TEAM_ID);
  const [orgName, setOrgName] = useState("Gym Dashboard");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([myTeamId]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sameDivisionOnly, setSameDivisionOnly] = useState(true);
  const [focusedId, setFocusedId] = useState<string>(myTeamId);
  const [sortBy, setSortBy] = useState<"average" | "ceiling" | "best" | "hitZero" | "percentile">(
    "average"
  );
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showScoutingReport, setShowScoutingReport] = useState(false);
  const [reportName, setReportName] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  

useEffect(() => {
  async function loadCompetitionProfiles() {
    setLoading(true);
    setError(null);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    const userId = session?.user?.id;

    if (sessionError || !userId) {
      setError("Please log in to view Competition Intelligence.");
      setLoading(false);
      return;
    }

    setCurrentUserId(userId);

    // Resolve the user's active Gym Dashboard organization.
    const { data: membership, error: membershipError } = await supabase
      .from("v_user_organizations")
      .select(`
        organization_id,
        organization_name,
        subscription_status,
        role
      `)
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

    const activeOrganizationId = membership.organization_id;

    setOrganizationId(activeOrganizationId);
    setOrgName(membership.organization_name ?? "Gym Dashboard");

    // Load the exact team IDs this organization owns.
    // Program-scoped gyms are expanded to their teams inside this view.
    // Team-scoped gyms such as Top Gun Miami use organization_teams.
    const { data: accessRows, error: accessError } = await supabase
      .from("v_organization_team_access")
      .select("team_id")
      .eq("organization_id", activeOrganizationId);

    if (accessError) {
      setError(accessError.message);
      setLoading(false);
      return;
    }

    const authorizedTeamIds = Array.from(
      new Set(
        (accessRows ?? [])
          .map((row) => row.team_id)
          .filter((teamId): teamId is string => Boolean(teamId)),
      ),
    );

    if (authorizedTeamIds.length === 0) {
      setError("No teams are linked to this gym.");
      setLoading(false);
      return;
    }

    // Load the full eligible population for opponent search.
    const { data: profileRows, error: profilesError } = await supabase
      .from("v_competition_intelligence_team_profiles")
      .select(
        "id, program_id, program, team, name, division, average, ceiling, best, best_event, hit_zero, events, avg_event_size_stars, avg_event_size_label, national_percentile, trend",
      )
      .not("division", "ilike", "%U16%")
      .not("division", "ilike", "%U18%")
      .not("division", "ilike", "%International%")
      .order("program", { ascending: true })
      .order("team", { ascending: true });

    if (profilesError) {
      setError(profilesError.message);
      setLoading(false);
      return;
    }

    const liveTeams: Team[] = (profileRows ?? []).map(
      (row: CompetitionProfileRow) => ({
        id: row.id,
        programId: row.program_id,
        name: row.name ?? row.team ?? "Unnamed Team",
        location: row.program ?? "",
        division: row.division,
        average: Number(row.average ?? 0),
        ceiling: Number(row.ceiling ?? 0),
        best: Number(row.best ?? 0),
        bestEvent: row.best_event ?? "—",
        hitZero: Number(row.hit_zero ?? 0),
        events: Number(row.events ?? 0),
        avgEventSizeStars: Number(row.avg_event_size_stars ?? 0),
        avgEventSizeLabel: row.avg_event_size_label ?? "—",
        nationalPercentile: Number(row.national_percentile ?? 0),
        trend: (row.trend ?? "Stable") as Team["trend"],
      }),
    );

    setTeams(liveTeams);

    const authorizedTeamIdSet = new Set(authorizedTeamIds);

    // My Teams are now determined by exact team authorization,
    // not by the source program name.
    const options: MyTeamOption[] = liveTeams
      .filter((team) => authorizedTeamIdSet.has(team.id))
      .map((team) => ({
        team_id: team.id,
        team: team.name,
        division: team.division ?? null,
        organization_name:
          membership.organization_name ?? "Gym Dashboard",
      }))
      .sort((a, b) => a.team.localeCompare(b.team));

    setMyTeams(options);

    const firstMyTeam = options[0];

    if (!firstMyTeam) {
      setError(
        "No competition intelligence profiles were found for this gym's authorized teams.",
      );
      setLoading(false);
      return;
    }

    const firstMyTeamId = firstMyTeam.team_id;

    setMyTeamId(firstMyTeamId);
    setFocusedId(firstMyTeamId);

    const { data: savedField, error: savedFieldError } = await supabase
      .from("competition_intelligence_fields")
      .select("selected_team_ids")
      .eq("organization_id", activeOrganizationId)
      .eq("my_team_id", firstMyTeamId)
      .maybeSingle();

    if (savedFieldError) {
      setError(savedFieldError.message);
      setSelectedIds([firstMyTeamId]);
      setLoading(false);
      return;
    }

    const savedIds = savedField?.selected_team_ids ?? [];

    const validSavedIds = savedIds.filter((id: string) =>
      liveTeams.some((team) => team.id === id),
    );

    const initialSelectedIds = [
      firstMyTeamId,
      ...validSavedIds.filter(
        (id: string) => id !== firstMyTeamId,
      ),
    ].slice(0, 12);

    setSelectedIds(initialSelectedIds);
    setLoading(false);
  }

  loadCompetitionProfiles();
}, []);

  const selectedTeams = teams.filter((t) => selectedIds.includes(t.id));
  const selectedOpponents = selectedTeams.filter((team) => team.id !== myTeamId);
  const myTeam = selectedTeams.find((t) => t.id === myTeamId) ?? selectedTeams[0] ?? teams[0];
  const focusedTeam = selectedTeams.find((t) => t.id === focusedId) ?? selectedTeams[1] ?? myTeam;
    const sortedTeams = useMemo(() => {
    return [...selectedTeams].sort((a, b) => {
      if (sortBy === "percentile") return b.nationalPercentile - a.nationalPercentile;
      return Number(b[sortBy]) - Number(a[sortBy]);
    });
  }, [selectedTeams, sortBy]);
  if (loading) {
  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-950">
      <GymDashboardSidebar organizationName={orgName} role="Owner" />
      <main className="ml-64 flex flex-1 items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 font-semibold shadow-sm">
          Loading Competition Intelligence...
        </div>
      </main>
    </div>
  );
}

if (!myTeam) {
  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-950">
      <GymDashboardSidebar organizationName={orgName} role="Owner" />
      <main className="ml-64 flex flex-1 items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No competition intelligence teams found for this gym.
        </div>
      </main>
    </div>
  );
}




  const rankOf = (metric: keyof Team, asc = false) => {
    const list = [...selectedTeams].sort((a, b) =>
      asc ? Number(a[metric]) - Number(b[metric]) : Number(b[metric]) - Number(a[metric])
    );
    return list.findIndex((t) => t.id === myTeam.id) + 1;
  };

  const fieldAvg =
    selectedTeams.reduce((sum, t) => sum + t.average, 0) / Math.max(selectedTeams.length, 1);

  const averageRank = rankOf("average");
  const ceilingRank = rankOf("ceiling");
  const hitZeroRank = rankOf("hitZero");

  const fieldOutlook = getFieldOutlook({
    averageRank,
    ceilingRank,
    hitZeroRank,
    fieldSize: selectedTeams.length,
  });

  const fieldLeader = sortedTeams[0];
  const averageGap = fieldLeader ? myTeam.average - fieldLeader.average : 0;

  const teamsWithHigherCeiling = selectedTeams.filter(
    (team) => team.id !== myTeam.id && team.ceiling > myTeam.ceiling
  );

  const biggestThreat = [...selectedTeams]
    .filter((team) => team.id !== myTeam.id)
    .sort(
      (a, b) =>
        b.average +
        b.ceiling +
        b.hitZero / 100 -
        (a.average + a.ceiling + a.hitZero / 100)
    )[0];

  const sleeperTeam = [...selectedTeams]
    .filter(
      (team) =>
        team.id !== myTeam.id &&
        team.average < myTeam.average &&
        team.ceiling > myTeam.average
    )
    .sort((a, b) => b.ceiling - a.ceiling)[0];

  const consistencyRank = rankOf("hitZero");

  async function saveReport() {
  if (!organizationId || !currentUserId) {
    setError("Unable to save this field. Organization or user information is missing.");
    return;
  }

  const { error: saveError } = await supabase
    .from("competition_intelligence_fields")
    .upsert(
      {
        organization_id: organizationId,
        my_team_id: myTeamId,
        selected_team_ids: selectedIds,
        created_by: currentUserId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "organization_id,my_team_id",
      }
    );

  if (saveError) {
    setError(saveError.message);
    return;
  }

  setSavedMessage(`Field saved for ${myTeam.name}`);
  setShowSaveModal(false);
  setReportName("");

  setTimeout(() => setSavedMessage(""), 3000);
}
const availableTeams = teams.filter((team) => !selectedIds.includes(team.id));
const myTeamOptions = myTeams;
const rawSearchResults = availableTeams.filter((team) => {
  const query = searchTerm.toLowerCase().trim();

  if (!query) return false;

  const matchesSearch =
    team.name.toLowerCase().includes(query) ||
    team.location.toLowerCase().includes(query);

  if (!matchesSearch) return false;

  if (!sameDivisionOnly) return true;

  const myDivisionCore = getDivisionCore(myTeam.division);
  const myDivisionSize = getDivisionSize(myTeam.division);
  const teamDivisionCore = getDivisionCore(team.division);
  const teamDivisionSize = getDivisionSize(team.division);

  return (
    teamDivisionCore === myDivisionCore &&
    (teamDivisionSize === myDivisionSize || teamDivisionSize === null)
  );
});

const searchResults = rawSearchResults.slice(0, 12);
const hasSearchQuery = searchTerm.trim().length > 0;
const hasHiddenSearchResults = rawSearchResults.length > searchResults.length;
async function changeMyTeam(teamId: string) {
  setMyTeamId(teamId);
  setFocusedId(teamId);
  setSearchTerm("");

  console.log("Changing My Team to:", teamId);
  console.log("Current organizationId:", organizationId);

  if (!organizationId) {
    console.log("No organizationId available; resetting field.");
    setSelectedIds([teamId]);
    return;
  }

  const { data: savedField, error: savedFieldError } = await supabase
    .from("competition_intelligence_fields")
    .select("selected_team_ids")
    .eq("organization_id", organizationId)
    .eq("my_team_id", teamId)
    .maybeSingle();

  console.log("Saved field returned:", savedField);
  console.log("Saved field error:", savedFieldError);

  if (savedFieldError) {
    setError(savedFieldError.message);
    setSelectedIds([teamId]);
    return;
  }

  const savedIds = savedField?.selected_team_ids ?? [];

  console.log("Saved IDs:", savedIds);

  const validSavedIds = savedIds.filter((id: string) =>
    teams.some((team) => team.id === id)
  );

  console.log("Valid saved IDs:", validSavedIds);

  const nextSelectedIds = [
    teamId,
    ...validSavedIds.filter((id: string) => id !== teamId),
  ].slice(0, 12);

  console.log("Next selected IDs:", nextSelectedIds);

  setSelectedIds(nextSelectedIds);
}
function addTeam(teamId: string) {
  setSelectedIds((current) => {
    if (current.includes(teamId)) return current;
    if (current.length >= 12) return current;
    return [...current, teamId];
  });

  setFocusedId(teamId);
  setSearchTerm("");
}

function removeTeam(teamId: string) {
  const teamToRemove = teams.find((team) => team.id === teamId);

  if (teamId === myTeamId) return;

  setSelectedIds((current) => current.filter((id) => id !== teamId));

  if (focusedId === teamId) {
    setFocusedId(myTeam.id);
  }
}

if (loading) {
  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-950">
      <GymDashboardSidebar organizationName={orgName} role="Owner" />
      <main className="ml-64 flex flex-1 items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 font-semibold shadow-sm">
          Loading Competition Intelligence...
        </div>
      </main>
    </div>
  );
}
  return (
  <div className="flex min-h-screen w-full bg-slate-50 text-slate-950">
    <GymDashboardSidebar organizationName={orgName} role="Owner" />

    <main className="ml-64 min-w-0 flex-1 overflow-x-hidden p-6 xl:p-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Competition Intelligence</h1>
            <p className="mt-1 text-slate-500">Build a field and scout your competition.</p>
          </div>

          <div className="flex gap-3">
<button
  onClick={() =>
    router.push(
      `/gym-dashboard/competition-intelligence/report?myTeamId=${myTeamId}&teamIds=${selectedIds.join(",")}`
    )
  }
  className="rounded-xl bg-purple-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-purple-700"
>
  Generate Report
</button>

<button
  onClick={() => setShowSaveModal(true)}
  className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold shadow-sm hover:bg-slate-50"
>
  Save Field
</button>

  <button
    disabled
    className="cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 font-semibold text-slate-400 shadow-sm"
  >
    Export PDF
  </button>
</div>

          {savedMessage && (
            <div className="mt-2 text-right text-sm font-semibold text-emerald-600">
              {savedMessage}
            </div>
          )}
        </div>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="flex items-center justify-between">
    <h2 className="font-bold uppercase tracking-wide">Build Your Field</h2>

    <button
      onClick={() => {
        setSelectedIds([myTeamId]);
        setFocusedId(myTeamId);
        setSearchTerm("");
      }}
      className="text-sm font-semibold text-slate-500 hover:text-slate-900"
    >
      Reset Field
    </button>
  </div>
<div className="mt-4 grid gap-4 lg:grid-cols-[420px_1fr]">
  <div>
    <label className="mb-2 block text-sm font-semibold text-slate-500">
      My Team
    </label>

    <select
      value={myTeamId}
      onChange={(e) => changeMyTeam(e.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-purple-400"
    >
      {myTeamOptions.map((team) => (
        <option key={team.team_id} value={team.team_id}>
          {team.team} — {team.division ?? "Division TBD"}
        </option>
      ))}
    </select>
  </div>

  <div>
    <label className="mb-2 block text-sm font-semibold text-slate-500">
      Search Opponents
    </label>

    {  <div className="relative mt-4">
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-purple-400"
      placeholder="Search teams by name, gym, or location..."
    />
<label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
  <input
    type="checkbox"
    checked={sameDivisionOnly}
    onChange={(e) => setSameDivisionOnly(e.target.checked)}
  />
  Same division only
</label>
    {hasSearchQuery && (
  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
    {searchResults.length > 0 ? (
      <>
        {searchResults.map((team) => (
          <button
            key={team.id}
            onClick={() => addTeam(team.id)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-purple-50"
          >
            <div>
              <div className="font-semibold text-slate-950">{team.name}</div>
              <div className="text-sm text-slate-500">
                {team.location} · {team.division ?? "Division TBD"}
              </div>
            </div>

            <span className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-purple-700">
              Add
            </span>
          </button>
        ))}

        {hasHiddenSearchResults && (
          <div className="border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500">
            Showing first 12 matches. Keep typing to narrow results.
          </div>
        )}
      </>
    ) : (
      <div className="px-4 py-4 text-sm text-slate-500">
        {sameDivisionOnly
          ? "No same-division matches found. Try unchecking Same division only."
          : "No matching teams found."}
      </div>
    )}
  </div>
)}
  </div>}
  </div>
</div>


  <div className="mt-4">
  <div className="mb-2 text-sm font-semibold text-slate-500">
    Your Team
  </div>

  <div className="flex flex-wrap gap-2">
    {myTeam && (
      <button
        onClick={() => setFocusedId(myTeam.id)}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"
      >
        <span>👑</span>
        <span>{myTeam.name}</span>
      </button>
    )}
  </div>

  <div className="mt-4 mb-2 text-sm font-semibold text-slate-500">
    Opponents ({selectedOpponents.length}/11)
  </div>
{selectedOpponents.length >= 11 && (
  <div className="mt-3 text-xs font-semibold text-amber-600">
    Maximum field size reached. Remove an opponent to add another.
  </div>
)}
  <div className="flex flex-wrap gap-2">
    {selectedOpponents.length > 0 ? (
      selectedOpponents.map((team) => (
        <button
          key={team.id}
          onClick={() => setFocusedId(team.id)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
            focusedId === team.id
              ? "border-purple-400 bg-purple-50 text-purple-700"
              : "border-slate-200 bg-white text-slate-900"
          }`}
        >
          <span>⋮⋮</span>
          <span>{team.name}</span>

          <span
            onClick={(e) => {
              e.stopPropagation();
              removeTeam(team.id);
            }}
            className="ml-1 rounded-full px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            ×
          </span>
        </button>
      ))
    ) : (
      <div className="text-sm text-slate-400">
        Add opponents to build your field.
      </div>
    )}
  </div>
</div>
</section>

        {showScoutingReport && (
          <section className="mb-5 rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
            <div className="mb-5 border-b border-slate-100 pb-4">
              <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
                Scouting Report
              </div>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                {myTeam.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {myTeam.division ?? "Division TBD"} · {selectedTeams.length} teams in field
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl bg-emerald-50 p-4">
                <div className="text-sm font-bold text-emerald-800">Best Path</div>
                <p className="mt-2 text-sm leading-6 text-emerald-900">
                  {averageRank <= 3
                    ? "Stay clean and protect your average. Your current scoring profile puts you near the top of this field."
                    : "You likely need a season-best performance or mistakes from the leaders to move into podium range."}
                </p>
              </div>

              <div className="rounded-xl bg-amber-50 p-4">
                <div className="text-sm font-bold text-amber-800">Biggest Threat</div>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  {biggestThreat
                    ? `${biggestThreat.name} is the biggest threat based on average, ceiling, and consistency.`
                    : "Add opponents to identify the biggest threat."}
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-4">
                <div className="text-sm font-bold text-blue-800">Quick Read</div>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-blue-900">
                  <li>
                    • {averageGap >= 0
                      ? `You lead the field by ${averageGap.toFixed(2)} on average.`
                      : `You trail the field leader by ${Math.abs(averageGap).toFixed(2)} on average.`}
                  </li>
                  <li>• {teamsWithHigherCeiling.length} teams have a higher ceiling.</li>
                  <li>• Hit Zero ranks {ordinal(consistencyRank)} of {selectedTeams.length}.</li>
                </ul>
              </div>
            </div>

            {sleeperTeam && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-bold text-slate-800">Sleeper Team to Watch</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {sleeperTeam.name} averages below you but owns a ceiling of {sleeperTeam.ceiling.toFixed(2)}, making them dangerous if they hit their best routine.
                </p>
              </div>
            )}
          </section>
        )}

        <section className="mb-5 rounded-2xl border border-purple-200 bg-purple-50 p-5">
          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <div className="text-xs font-bold uppercase text-purple-700">Field Outlook</div>
              <h2 className="mt-2 text-xl font-bold text-purple-950">
                {fieldOutlook.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-purple-900">
                {fieldOutlook.body}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Average" value={ordinal(averageRank)} sub={`of ${selectedTeams.length}`} />

              <StatCard label="Ceiling" value={ordinal(ceilingRank)} sub={`of ${selectedTeams.length}`} />

              <StatCard label="Hit Zero" value={ordinal(hitZeroRank)} sub={`of ${selectedTeams.length}`} />

              <StatCard
  label="National Percentile"
  value={myTeam ? `Top ${myTeam.nationalPercentile}%` : "—"}
/>
            </div>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-6">
          <StatCard label="Teams in Field" value={selectedTeams.length} sub="Including you" />
          <StatCard label="Field Average" value={fieldAvg.toFixed(2)} sub="Strong field" />
          <StatCard label="Avg Event Size" value={stars(4)} sub="Large" />
          <StatCard
            label="Highest Average"
            value={Math.max(...selectedTeams.map((t) => t.average)).toFixed(2)}
            sub={sortedTeams[0]?.name}
          />
          <StatCard
            label="Highest Ceiling"
            value={Math.max(...selectedTeams.map((t) => t.ceiling)).toFixed(2)}
            sub={[...selectedTeams].sort((a, b) => b.ceiling - a.ceiling)[0]?.name}
          />
          <StatCard
            label="Most Consistent"
            value={`${Math.max(...selectedTeams.map((t) => t.hitZero))}%`}
            sub={[...selectedTeams].sort((a, b) => b.hitZero - a.hitZero)[0]?.name}
          />
        </section>

        <section className="mb-5">
          <StrengthLandscape
  teams={sortedTeams}
  myTeam={myTeam}
  myTeamId={myTeamId}
  focusedId={focusedId}
  setFocusedId={setFocusedId}
/>
        </section>

        <section className="grid gap-5">
  <div>
    <div className="mb-3 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold">Team Comparison</h2>
        <p className="text-sm text-slate-500">Focused team: {focusedTeam.name}</p>
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <TeamCompareCard team={focusedTeam} focused={focusedTeam} />
      <TeamCompareCard team={myTeam} focused={focusedTeam} isMine />
    </div>

    <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
      <span className="text-emerald-600">● Better than {focusedTeam.name}</span>
      <span className="text-red-500">● Worse than {focusedTeam.name}</span>
      <span className="text-slate-400">● Same as {focusedTeam.name}</span>
    </div>
  </div>

  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold">Complete Field</h2>
        <p className="text-sm text-slate-500">All teams in this selected field.</p>
      </div>

      <div className="flex gap-2">
        {[
          ["average", "Average"],
          ["ceiling", "Ceiling"],
          ["best", "Best"],
          ["hitZero", "HZR"],
          ["percentile", "Percentile"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortBy(key as typeof sortBy)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              sortBy === key ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>

    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-xs uppercase text-slate-500">
          <th className="py-3">#</th>
          <th>Team</th>
          <th
  className={`${
    sortBy === "average"
      ? "bg-purple-100 text-purple-700 font-bold"
      : ""
  }`}
>
  AVG
</th>
          <th
  className={`${
    sortBy === "ceiling"
      ? "bg-purple-100 text-purple-700 font-bold"
      : ""
  }`}
>
  Ceiling
</th>
          <th
  className={`${
    sortBy === "best"
      ? "bg-purple-100 text-purple-700 font-bold"
      : ""
  }`}
>
  Best
</th>
          <th
  className={`${
    sortBy === "hitZero"
      ? "bg-purple-100 text-purple-700 font-bold"
      : ""
  }`}
>
  HZR
</th>
          <th>Events</th>
          <th>Avg Size</th>
          <th
  className={`${
    sortBy === "percentile"
      ? "bg-purple-100 text-purple-700 font-bold"
      : ""
  }`}
>
  National Percentile
</th>
          
        </tr>
      </thead>
      <tbody>
        {sortedTeams.map((team, index) => (
          <tr
            key={team.id}
            onClick={() => setFocusedId(team.id)}
            className={`cursor-pointer border-b hover:bg-purple-50 ${
              team.id === focusedId
                ? "bg-purple-50"
                : team.id === myTeamId
                ? "bg-blue-50"
                : "bg-white"
            }`}
          >
            <td className="py-4 font-bold">{index + 1}</td>
            <td className="font-semibold">
  <div>
    {team.id === myTeamId ? "👑 " : ""}
    {team.name}
    {team.id === myTeamId && <span className="text-blue-600"> (You)</span>}
  </div>
  <div className="mt-1 text-xs font-medium text-slate-500">
    {team.division ?? "Division TBD"}
  </div>
</td>
            <td
  className={
    sortBy === "average"
      ? "bg-purple-50 font-semibold"
      : ""
  }
>
  {team.average.toFixed(2)}
</td>
            <td
  className={
    sortBy === "ceiling"
      ? "bg-purple-50 font-semibold"
      : ""
  }
>
  {team.ceiling.toFixed(2)}
</td>
            <td
  className={
    sortBy === "best"
      ? "bg-purple-50"
      : ""
  }
>
 <div
  className={
    sortBy === "best"
      ? "font-semibold"
      : ""
  }
>
  {team.best.toFixed(2)}
</div>

  <div className="text-xs text-slate-500">
    {stars(team.avgEventSizeStars)}
    <br />
    {team.bestEvent}
  </div>
</td>
            <td
  className={
    sortBy === "hitZero"
      ? "bg-purple-50 font-semibold"
      : ""
  }
>
  {Math.round(team.hitZero)}%
</td>
            <td>{team.events}</td>
            <td>
              {stars(team.avgEventSizeStars)}
              <div className="text-xs text-slate-500">{team.avgEventSizeLabel}</div>
            </td>
            <td
  className={
    sortBy === "percentile"
      ? "bg-purple-50 font-semibold"
      : ""
  }
>
  Top {Math.round(team.nationalPercentile)}%
</td>
            
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</section>

        {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-xl font-bold text-slate-950">Save Field</h2>
              <p className="mt-1 text-sm text-slate-500">
                Save this selected field so you can reopen it later.
              </p>

              <input
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-purple-400"
                placeholder="Report name..."
                autoFocus
              />

              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowSaveModal(false);
                    setReportName("");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  onClick={saveReport}
                  className="rounded-xl bg-purple-600 px-4 py-2 font-semibold text-white hover:bg-purple-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
            </div>
    </main>
  </div>
);
}