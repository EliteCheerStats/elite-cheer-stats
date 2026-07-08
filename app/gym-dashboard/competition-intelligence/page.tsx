"use client";

import { useEffect, useMemo, useState } from "react";
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
        <svg width={980} height={420} className="min-w-[980px]">
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={40}
                x2={940}
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
            x2={940}
            y1={y(myTeam.average) + 30}
            y2={y(myTeam.average) + 30}
            stroke="#2563eb"
            strokeDasharray="5 5"
          />

          <text x={785} y={y(myTeam.average) + 22} fontSize="12" fill="#2563eb">
            Your Avg {myTeam.average.toFixed(2)}
          </text>

          {teams.map((team, index) => {
            const x = 80 + index * 145;
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
                  {team.name.split(" ").slice(0, 2).join(" ")}
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
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeams, setMyTeams] = useState<MyTeamOption[]>([]);
  const [myTeamId, setMyTeamId] = useState(MY_TEAM_ID);
  const [orgName, setOrgName] = useState("Gym Dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([myTeamId]);
  const [searchTerm, setSearchTerm] = useState("");
  const [focusedId, setFocusedId] = useState<string>(myTeamId);
  const [sortBy, setSortBy] = useState<"average" | "ceiling" | "best" | "hitZero" | "percentile">(
    "average"
  );
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [reportName, setReportName] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  

useEffect(() => {
  async function loadCompetitionProfiles() {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      setError("Please log in to view Competition Intelligence.");
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
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      setError(membershipError.message);
      setLoading(false);
      return;
    }
const orgRelation = membership?.["organizations"];

const organization = (
  Array.isArray(orgRelation) ? orgRelation[0] : orgRelation
) as {
  id: string;
  name: string;
  subscription_status: string;
} | null;

if (!organization || organization.subscription_status !== "active") {
  setError("Gym Dashboard access is not active for this account.");
  setLoading(false);
  return;
}

setOrgName(organization.name);

if (!membership?.organization_id) {
  setError("No gym organization found for this account.");
  setLoading(false);
  return;
}

const { data: orgPrograms, error: orgProgramsError } = await supabase
  .from("organization_programs")
  .select("program_id")
  .eq("organization_id", membership.organization_id);

if (orgProgramsError) {
  setError(orgProgramsError.message);
  setLoading(false);
  return;
}

const programIds = (orgPrograms ?? []).map((row) => row.program_id);

if (programIds.length === 0) {
  setError("No programs are linked to this gym.");
  setLoading(false);
  return;
}


const { data, error } = await supabase
  .from("v_competition_intelligence_team_profiles")
  .select(
    "id, program_id, program, team, name, division, average, ceiling, best, best_event, hit_zero, events, avg_event_size_stars, avg_event_size_label, national_percentile, trend"
  )
  .not("division", "ilike", "%U16%")
  .not("division", "ilike", "%U18%")
  .not("division", "ilike", "%International%")
  .order("program", { ascending: true })
  .order("team", { ascending: true });
 

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const liveTeams: Team[] = (data ?? []).map((row: CompetitionProfileRow) => ({
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
}));

setTeams(liveTeams);

const myProgramIdSet = new Set(programIds);

const options: MyTeamOption[] = liveTeams
  .filter((team) => myProgramIdSet.has(team.programId))
  .map((team) => ({
    team_id: team.id,
    team: team.name,
    division: team.division ?? null,
    organization_name: organization.name,
  }));

setMyTeams(options);

if (liveTeams[0]) {
  setMyTeamId(liveTeams[0].id);
  setSelectedIds([liveTeams[0].id]);
  setFocusedId(liveTeams[0].id);
}

    setLoading(false);
  }

  loadCompetitionProfiles();
}, []);

  const selectedTeams = teams.filter((t) => selectedIds.includes(t.id));
  const myTeam = selectedTeams.find((t) => t.id === myTeamId) ?? selectedTeams[0] ?? teams[0];
  const focusedTeam = selectedTeams.find((t) => t.id === focusedId) ?? selectedTeams[1] ?? myTeam;
    const sortedTeams = useMemo(() => {
    return [...selectedTeams].sort((a, b) => {
      if (sortBy === "percentile") return a.nationalPercentile - b.nationalPercentile;
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

  function saveReport() {
    const name = reportName.trim() || `Scouting Report - ${new Date().toLocaleDateString()}`;

    const savedReport = {
      id: crypto.randomUUID(),
      name,
      selectedIds,
      focusedId,
      sortBy,
      createdAt: new Date().toISOString(),
    };

    const existing = JSON.parse(localStorage.getItem("competitionReports") || "[]");
    localStorage.setItem("competitionReports", JSON.stringify([savedReport, ...existing]));

    setSavedMessage(`Saved "${name}"`);
    setShowSaveModal(false);
    setReportName("");

    setTimeout(() => setSavedMessage(""), 3000);
  }
const availableTeams = teams.filter((team) => !selectedIds.includes(team.id));
const myTeamOptions = myTeams;
const searchResults = availableTeams.filter((team) => {
  const query = searchTerm.toLowerCase().trim();

  if (!query) return false;

  return (
    team.name.toLowerCase().includes(query) ||
    team.location.toLowerCase().includes(query)
  );
});
function changeMyTeam(teamId: string) {
  setMyTeamId(teamId);

  setSelectedIds((current) => {
    const withoutOldMyTeam = current.filter((id) => id !== myTeamId);
    return [teamId, ...withoutOldMyTeam.filter((id) => id !== teamId)];
  });

  setFocusedId(teamId);
}
function addTeam(teamId: string) {
  setSelectedIds((current) => [...current, teamId]);
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
    onClick={() => setShowSaveModal(true)}
    className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold shadow-sm hover:bg-slate-50"
  >
    Save Report
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
<div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
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

    {searchResults.length > 0 && (
      <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        {searchResults.map((team) => (
          <button
            key={team.id}
            onClick={() => addTeam(team.id)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-purple-50"
          >
            <div>
              <div className="font-semibold text-slate-950">{team.name}</div>
              <div className="text-sm text-slate-500">{team.location}</div>
            </div>

            <span className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-purple-700">
              Add
            </span>
          </button>
        ))}
      </div>
    )}
  </div>}
  </div>
</div>


  <div className="mt-4">
    <div className="mb-2 text-sm font-semibold text-slate-500">
      Selected Teams ({selectedTeams.length})
    </div>

    <div className="flex flex-wrap gap-2">
      {selectedTeams.map((team) => (
        <button
          key={team.id}
          onClick={() => setFocusedId(team.id)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
            focusedId === team.id
              ? "border-purple-400 bg-purple-50 text-purple-700"
              : team.id === myTeamId
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : "border-slate-200 bg-white text-slate-900"
          }`}
        >
          <span>{team.id === myTeamId ? "👑" : "⋮⋮"}</span>
          <span>{team.name}</span>

          {team.id !== myTeamId && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                removeTeam(team.id);
              }}
              className="ml-1 rounded-full px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              ×
            </span>
          )}
        </button>
      ))}
    </div>
  </div>
</section>

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
          <th>Avg</th>
          <th>Ceiling</th>
          <th>Best</th>
          <th>HZR</th>
          <th>Events</th>
          <th>Avg Size</th>
          <th>National Percentile</th>
          <th>Trend</th>
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
              {team.id === myTeamId ? "👑 " : ""}
              {team.name}
              {team.id === myTeamId && <span className="text-blue-600"> (You)</span>}
            </td>
            <td>{team.average.toFixed(2)}</td>
            <td>{team.ceiling.toFixed(2)}</td>
            <td>
              <div className="font-semibold">{team.best.toFixed(2)}</div>
              <div className="text-xs text-slate-500">
                {stars(team.avgEventSizeStars)}
                <br />
                {team.bestEvent}
              </div>
            </td>
            <td>{team.hitZero}%</td>
            <td>{team.events}</td>
            <td>
              {stars(team.avgEventSizeStars)}
              <div className="text-xs text-slate-500">{team.avgEventSizeLabel}</div>
            </td>
            <td className="font-semibold">Top {team.nationalPercentile}%</td>
            <td
              className={`font-semibold ${
                team.trend === "Falling" ? "text-red-500" : "text-emerald-600"
              }`}
            >
              {team.trend === "Falling" ? "↘" : "↗"} {team.trend}
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
              <h2 className="text-xl font-bold text-slate-950">Save Scouting Report</h2>
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