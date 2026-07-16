"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import GymDashboardSidebar from "@/app/gym-dashboard/components/GymDashboardSidebar";

type OrgTeam = {
  id: string;
  name: string;
  division?: string | null;
  programName?: string | null;
};

const fallbackOrganizationName = "All Star Athletics";
const fallbackOrganizationInitials = "AA";



function fmtScore(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toFixed(2);
}

function fmtDelta(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";

  const n = Number(value);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}

function fmtPercentDelta(value: number) {
  return `${value >= 0 ? "+" : ""}${Math.round(value)}%`;
}


function percentileColor(percentile: number) {
  if (percentile < 50) return "text-red-400";
  if (percentile < 75) return "text-yellow-400";
  if (percentile < 90) return "text-emerald-400";
  return "text-yellow-300";
}
function averageLabel(gap: number | null | undefined) {
  if (gap == null) return "—";
  if (gap > 0.01) return "Above Average";
  if (gap < -0.01) return "Below Average";
  return "At Division Average";
}
function ordinal(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function SidebarItem({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-xl px-4 py-3 text-sm font-semibold transition ${
        active
          ? "bg-blue-600 text-white"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function InfoIcon({ tooltip }: { tooltip?: string }) {
  return (
    <span className="group relative inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] text-slate-500">
      i
      {tooltip && (
        <span className="pointer-events-none absolute left-1/2 top-6 z-50 hidden w-72 -translate-x-1/2 rounded-xl bg-slate-950 p-3 text-left text-xs font-normal leading-5 text-white shadow-xl group-hover:block">
          {tooltip}
        </span>
      )}
    </span>
  );
}

function GapCard({
  title,
  delta,
  sub,
  label,
  highlighted,
  tooltip,
}: {
  title: string;
  delta: number;
  sub: string;
  label: string;
  highlighted?: boolean;
  tooltip?: string;
}) {
  const positive = delta >= 0;

  return (
    <div
      className={`rounded-xl border p-4 text-center ${
        highlighted
          ? "border-blue-400 bg-blue-50/60"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-900">
        {highlighted && <span className="text-blue-600">★</span>}
        {title}
        {tooltip && <InfoIcon tooltip={tooltip} />}
      </div>

      <div
        className={`mt-4 text-3xl font-black ${
          positive ? "text-emerald-600" : "text-red-600"
        }`}
      >
        {fmtDelta(delta)}
      </div>

      <div className="mt-2 text-sm text-slate-700">{sub}</div>

      <div
  className={`mt-3 text-sm font-bold ${
    title === "vs Division Average"
      ? positive
        ? "text-emerald-600"
        : "text-red-600"
      : "text-slate-900"
  }`}
>
  {label}
</div>
    </div>
  );
}

function ComparisonTable({
  title,
  compareLabel,
  mineLabel,
  rows,
}: {
  title: string;
  compareLabel: string;
  mineLabel: string;
  rows: {
    metric: string;
    mine: string;
    compare: string;
    delta: string;
    positive: boolean;
  }[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-4">
        <h3 className="text-xl font-black text-slate-950">{title}</h3>
        <InfoIcon />
      </div>

      <table className="w-full text-sm">
        <thead className="border-y border-slate-200 text-left text-slate-900">
          <tr>
            <th className="px-5 py-3">Metric</th>
            <th className="px-5 py-3">{mineLabel}</th>
            <th className="px-5 py-3">{compareLabel}</th>
            <th className="px-5 py-3">Delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.metric}>
              <td className="px-5 py-3 text-slate-700">{row.metric}</td>
              <td className="px-5 py-3 font-bold text-slate-950">{row.mine}</td>
              <td className="px-5 py-3 font-bold text-slate-950">
                {row.compare}
              </td>
              <td
                className={`px-5 py-3 font-bold ${
                  row.positive ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {row.delta}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TrendChart({ data }: { data: { date: string; score: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center">
        <div>
          <div className="text-lg font-black text-slate-900">
            No season data yet
          </div>
          <div className="mt-1 text-sm text-slate-500">
            This team has not competed in a regular season event yet.
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 1) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-center">
        <div>
          <div className="text-sm font-semibold text-slate-500">
            First event logged
          </div>
          <div className="mt-2 text-5xl font-black text-blue-600">
            {fmtScore(data[0].score)}
          </div>
          <div className="mt-2 text-sm text-slate-500">
            Season trend will appear after another regular season event.
          </div>
        </div>
      </div>
    );
  }

  const width = 1000;
  const height = 240;
  const pad = 40;
  const minY = 90;
  const maxY = 99;

  function x(index: number) {
    return pad + (index / (data.length - 1)) * (width - pad * 2);
  }

  function y(value: number) {
    return height - pad - ((value - minY) / (maxY - minY)) * (height - pad * 2);
  }

  const points = data
    .map((row, index) => `${x(index)},${y(row.score)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full">
      {[90, 92, 94, 96, 98].map((tick) => (
        <g key={tick}>
          <line
            x1={pad}
            x2={width - pad}
            y1={y(tick)}
            y2={y(tick)}
            stroke="rgba(15,23,42,0.08)"
          />
          <text x={10} y={y(tick) + 4} fontSize="12" fill="#475569">
            {tick}
          </text>
        </g>
      ))}

      <polyline
        points={points}
        fill="none"
        stroke="#2563eb"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {data.map((row, index) => (
        <g key={row.date}>
          <circle cx={x(index)} cy={y(row.score)} r="5" fill="#2563eb" />
          <text
            x={x(index)}
            y={height - 8}
            textAnchor="middle"
            fontSize="11"
            fill="#334155"
          >
            {row.date}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function DivisionIntelligencePage() {
  const pathname = usePathname();
  

  const [organizationName, setOrganizationName] = useState(
    fallbackOrganizationName,
  );
  const [organizationInitials, setOrganizationInitials] = useState(
    fallbackOrganizationInitials,
  );
  const [teams, setTeams] = useState<OrgTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [rpcData, setRpcData] = useState<any>(null);

  useEffect(() => {
  async function loadOrgAndTeams() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Unable to load authenticated user:", userError);
      return;
    }

    const { data: membership, error: membershipError } = await supabase
      .from("v_user_organizations")
      .select(`
        organization_id,
        organization_name,
        subscription_status,
        role
      `)
      .eq("user_id", user.id)
      .eq("subscription_status", "active")
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership) {
      console.error(
        "Unable to load active Gym Dashboard membership:",
        membershipError,
      );
      return;
    }

    if (membership.organization_name) {
      setOrganizationName(membership.organization_name);
      setOrganizationInitials(
        membership.organization_name
          .split(" ")
          .filter(Boolean)
          .map((word: string) => word[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      );
    }

    const { data: teamRows, error: teamsError } = await supabase
      .from("v_gym_overview_team_table")
      .select(`
        team_id,
        team,
        division,
        organization_name
      `)
      .eq("organization_id", membership.organization_id)
      .order("team", { ascending: true });

    if (teamsError) {
      console.error("Unable to load Division Intelligence teams:", teamsError);
      return;
    }

    const teamMap = new Map<string, OrgTeam>();

    for (const row of teamRows ?? []) {
      if (!teamMap.has(row.team_id)) {
        teamMap.set(row.team_id, {
          id: row.team_id,
          name: row.team,
          division: row.division ?? null,
          programName: null,
        });
      }
    }

    const activeTeams = Array.from(teamMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    setTeams(activeTeams);

    setSelectedTeamId((current) => {
      if (current && teamMap.has(current)) {
        return current;
      }

      return activeTeams[0]?.id ?? "";
    });
  }

  loadOrgAndTeams();
}, []);

const selectedTeam = useMemo(() => {
  return teams.find((t) => t.id === selectedTeamId) ?? null;
}, [teams, selectedTeamId]);



const rpcTeam = rpcData?.team;
const rpcTrend = rpcData?.trend ?? null;
const rpcDivision = rpcData?.division;
const rpcLeader = rpcData?.leader;



const divisionStats = {
  teamsTracked: rpcDivision?.teams_tracked ?? null,
  nationalPercentile: rpcDivision?.national_percentile ?? null,
  divisionRank: rpcDivision?.division_rank ?? null,
  avgScore: rpcDivision?.division_avg_score ?? null,
  top25Cut: rpcDivision?.top25_cut ?? null,
  top10Cut: rpcDivision?.top10_cut ?? null,
  bestScoreCut: rpcDivision?.best_score_cut ?? null,
};

const nationalPercentile =
  divisionStats.nationalPercentile !== null
    ? Math.round(divisionStats.nationalPercentile)
    : null;

const divisionAvg = {
  avgScore: divisionStats.avgScore,
  ceilingScore: rpcDivision?.division_avg_ceiling ?? null,
  hitZeroRate: rpcDivision?.division_avg_hzr ?? null,
};

const cutLines = {
  top25: divisionStats.top25Cut,
  top10: divisionStats.top10Cut,
  bestScore: divisionStats.bestScoreCut,
};

const leader = {
  team: rpcLeader?.team_name ?? null,
  program: rpcLeader?.program_name ?? null,
  division: rpcLeader?.division ?? rpcTeam?.division ?? null,
  avgScore: rpcLeader?.avg_score ?? null,
  ceilingScore: rpcLeader?.avg_ceiling ?? null,
  hitZeroRate: rpcLeader?.hit_zero_rate ?? null,
  confidence: rpcLeader?.confidence ?? null,
};


const currentTeam = {
  name: rpcTeam?.team_name ?? selectedTeam?.name ?? "—",
  division: rpcTeam?.division ?? selectedTeam?.division ?? "—",
  avgScore: rpcTeam?.avg_score ?? null,
  bestScore: rpcTeam?.best_score ?? null,
  ceilingScore: rpcTeam?.avg_ceiling ?? null,
  hitZeroRate: rpcTeam?.hit_zero_rate ?? null,
  totalEvents: rpcTeam?.total_events ?? null,
  avgEventSize: rpcTeam?.avg_event_size ?? null,
};
const liveTrendData =
  rpcTrend?.map((row: any) => ({
    date: row.date,
    score: Number(row.score),
  })) ?? [];
const bestScoreDate = rpcTeam?.best_score_date
  ? new Date(rpcTeam.best_score_date).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "2-digit",
    })
  : "—";

useEffect(() => {
  if (!selectedTeamId) {
    setRpcData(null);
    return;
  }

  setRpcData(null);

  async function loadRpcDivisionIntelligence() {
    const { data, error } = await supabase.rpc(
      "get_division_intelligence_page",
      {
        p_team_id: selectedTeamId,
      },
    );

    if (error) {
      setRpcData(null);
      return;
    }

    setRpcData(data ?? null);
  }

  loadRpcDivisionIntelligence();
}, [selectedTeamId]);
const gapToAverage = currentTeam.avgScore - divisionAvg.avgScore;
const gapToTop25 = currentTeam.avgScore - cutLines.top25;
const gapToTop10 = currentTeam.avgScore - cutLines.top10;
const gapToLeader = currentTeam.avgScore - leader.avgScore;
const gapToBestScore = currentTeam.bestScore - cutLines.bestScore;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <GymDashboardSidebar organizationName={organizationName} />

      <main className="ml-72 p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-black">Division Intelligence</h1>
              <InfoIcon />
            </div>
            <p className="mt-2 text-slate-600">
              Key benchmarks and gaps to help you understand where your team
              stands.
            </p>
          </div>

          <div className="flex items-end gap-6">
            <div>
              <label className="text-sm font-semibold">Select Team</label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="mt-1 w-96 rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold"
              >
                {teams.length === 0 ? (
                  <option value="">Loading teams...</option>
                ) : (
                  teams.map((teamOption) => (
                    <option key={teamOption.id} value={teamOption.id}>
                      {teamOption.name}
                      {teamOption.division ? ` - ${teamOption.division}` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            <button className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-semibold">
              Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[1.45fr_1fr] gap-6">
          <div className="space-y-5">
            <section className="grid grid-cols-[auto_1fr_1fr] items-center rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mr-8 flex h-28 w-28 items-center justify-center rounded-lg bg-black text-7xl font-black text-blue-600">
                R
              </div>

              <div>
                <div className="text-sm font-medium text-slate-600">
  {rpcTeam?.program_name}
</div>
                <h2 className="text-3xl font-black">{currentTeam.name}</h2>
                <div className="mt-1 text-2xl font-bold text-blue-600">
                  {currentTeam.division}
                </div>
                <div className="mt-5 text-base text-slate-700">
                  {divisionStats.teamsTracked !== null
  ? `${divisionStats.teamsTracked} Teams Tracked`
  : "— Teams Tracked"}
                </div>
                <div className="text-sm text-slate-500">
                  (Excludes Championships)
                </div>
              </div>

              <div className="border-l border-slate-200 text-center">
                <div
                  className={`text-5xl font-black ${
  nationalPercentile !== null
    ? percentileColor(nationalPercentile)
    : "text-slate-300"
}`}
                >
                  {nationalPercentile !== null ? ordinal(nationalPercentile) : "—"}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 font-bold">
                  Percentile <InfoIcon />
                </div>
                <div className="mt-5 text-slate-600">
                  Better than {nationalPercentile !== null ? `${nationalPercentile}%` : "—"} of
                  <br />
                  teams in this division
                </div>
              </div>
            </section>

           <section className="rounded-2xl border border-slate-200 bg-white p-6">
  <div className="flex items-center gap-2">
    <h3 className="text-xl font-black">Division Position</h3>
    <InfoIcon />
  </div>

  <p className="mt-1 text-sm text-slate-600">
    How your team compares to others in this division.
  </p>

  <div className="mt-14">
    <div className="relative h-12">
      <div className="absolute top-4 h-3 w-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-600" />

      {nationalPercentile !== null && (
        <div
          className="absolute -top-6"
          style={{ left: `${nationalPercentile}%` }}
        >
          <div className="-translate-x-1/2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">
            {ordinal(nationalPercentile)}
          </div>

          <div className="mx-auto h-10 w-1 bg-blue-600" />
        </div>
      )}
    </div>

    <div className="mt-1 grid grid-cols-5 text-sm font-bold">
      <div className="text-red-500">0%</div>
      <div className="text-center">25%</div>
      <div className="text-center">50%</div>
      <div className="text-center">75%</div>
      <div className="text-right text-emerald-600">100%</div>
    </div>

    <div className="mt-4 flex justify-between text-slate-700">
      <div>Bottom</div>
      <div>Average</div>
      <div>Elite</div>
    </div>
  </div>
</section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black">Gap Analysis</h3>
                <InfoIcon />
              </div>
             <p className="mt-1 text-sm text-slate-600">
  Key competitive benchmarks for your division.
</p>

              <div className="mt-4 grid grid-cols-5 gap-3">
                <GapCard
  title="vs Division Average"
  delta={gapToAverage}
  sub={`${fmtScore(currentTeam.avgScore)} vs ${fmtScore(divisionAvg.avgScore)}`}
  label={averageLabel(gapToAverage)}
/>
                <GapCard
                  title="Gap to Top 25"
                  delta={gapToTop25}
                  sub={`${fmtScore(currentTeam.avgScore)} vs ${fmtScore(cutLines.top25)}`}
                  label="Based on season average"
                />
                <GapCard
                  title="Gap to Top 10"
                  delta={gapToTop10}
                  sub={`${fmtScore(currentTeam.avgScore)} vs ${fmtScore(cutLines.top10)}`}
                  label="Based on season average"
                />
                <GapCard
                  title="Gap to Leader"
                  delta={gapToLeader}
                  sub={`${fmtScore(currentTeam.avgScore)} vs ${fmtScore(leader.avgScore)}`}
                  label="Based on season average"
                />
                <GapCard
                  title="Best Score"
                  delta={gapToBestScore}
                  sub={`${fmtScore(currentTeam.bestScore)} vs ${fmtScore(cutLines.bestScore)}`}
                  label="Highest event score this season"
                  highlighted
                  tooltip={`Best Score compares ${currentTeam.name}'s highest Event Score this season against the highest Event Score recorded this season.`}
                />
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏆</span>
                  <h3 className="text-xl font-black">Division Leader</h3>
                  <InfoIcon />
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
                  {leader.confidence}
                  <InfoIcon />
                </div>
              </div>
<div className="mt-5 flex items-baseline gap-2">
  <span className="text-3xl font-black">
    {leader.team}
  </span>

  <span className="text-3xl font-black text-slate-500">
    -
  </span>

  <span className="text-2xl font-semibold text-slate-600">
    {leader.program}
  </span>
</div>

<div className="mt-1 text-lg text-slate-700">
  {leader.division}
</div>

              <div className="mt-8 grid grid-cols-3 divide-x divide-slate-200 text-center">
                <div>
                  <div className="text-sm text-slate-600">Avg Score</div>
                  <div className="mt-2 text-3xl font-black">
                    {fmtScore(leader.avgScore)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">Ceiling Score</div>
                  <div className="mt-2 text-3xl font-black">
                    {fmtScore(leader.ceilingScore)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">Hit Zero Rate</div>
                  <div className="mt-2 text-3xl font-black">
                    {leader.hitZeroRate}%
                  </div>
                </div>
              </div>
            </section>

            <ComparisonTable
              title={`${currentTeam.name} vs ${leader.team}`}
              compareLabel={leader.team}
              mineLabel={currentTeam.name}
              rows={[
                {
                  metric: "Average Score",
                  mine: fmtScore(currentTeam.avgScore),
                  compare: fmtScore(leader.avgScore),
                  delta: fmtDelta(currentTeam.avgScore - leader.avgScore),
                  positive: currentTeam.avgScore - leader.avgScore >= 0,
                },
                {
                  metric: "Ceiling Score",
                  mine: fmtScore(currentTeam.ceilingScore),
                  compare: fmtScore(leader.ceilingScore),
                  delta: fmtDelta(
                    currentTeam.ceilingScore - leader.ceilingScore,
                  ),
                  positive: currentTeam.ceilingScore - leader.ceilingScore >= 0,
                },
                {
                  metric: "Hit Zero Rate",
                  mine: `${currentTeam.hitZeroRate}%`,
                  compare: `${leader.hitZeroRate}%`,
                  delta: fmtPercentDelta(
                    currentTeam.hitZeroRate - leader.hitZeroRate,
                  ),
                  positive: currentTeam.hitZeroRate - leader.hitZeroRate >= 0,
                },
              ]}
            />

            <ComparisonTable
              title={`${currentTeam.name} vs Division Average`}
              compareLabel="Div Avg"
              mineLabel={currentTeam.name}
              rows={[
                {
                  metric: "Average Score",
                  mine: fmtScore(currentTeam.avgScore),
                  compare: fmtScore(divisionAvg.avgScore),
                  delta: fmtDelta(currentTeam.avgScore - divisionAvg.avgScore),
                  positive: currentTeam.avgScore - divisionAvg.avgScore >= 0,
                },
                {
                  metric: "Ceiling Score",
                  mine: fmtScore(currentTeam.ceilingScore),
                  compare: fmtScore(divisionAvg.ceilingScore),
                  delta: fmtDelta(
                    currentTeam.ceilingScore - divisionAvg.ceilingScore,
                  ),
                  positive:
                    currentTeam.ceilingScore - divisionAvg.ceilingScore >= 0,
                },
                {
                  metric: "Hit Zero Rate",
                  mine: `${currentTeam.hitZeroRate}%`,
                  compare: `${divisionAvg.hitZeroRate}%`,
                  delta: fmtPercentDelta(
                    currentTeam.hitZeroRate - divisionAvg.hitZeroRate,
                  ),
                  positive:
                    currentTeam.hitZeroRate - divisionAvg.hitZeroRate >= 0,
                },
              ]}
            />
          </div>
        </div>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-[1.55fr_1fr] gap-6">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black">Season Summary</h3>
                <InfoIcon />
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Average Score over time
              </p>

              <TrendChart data={liveTrendData} />

              <p className="mt-2 text-center text-sm text-slate-500">
                Includes regular season events only. Championships are excluded.
              </p>
            </div>

            <div className="self-stretch rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black">
                  Season Stats - At a Glance
                </h3>
                <InfoIcon />
              </div>

              <div className="mt-10 grid grid-cols-3 gap-8 text-center">
  <div>
    <div className="text-sm font-semibold text-slate-600">
      Average Ceiling
    </div>
    <div className="mt-3 text-3xl font-black">
      {fmtScore(currentTeam.ceilingScore)}
    </div>
  </div>

  <div>
    <div className="text-sm font-semibold text-slate-600">
      Season Average
    </div>
    <div className="mt-3 text-3xl font-black">
      {fmtScore(currentTeam.avgScore)}
    </div>
  </div>

  <div>
    <div className="text-sm font-semibold text-slate-600">
      Hit Zero Rate
    </div>
    <div className="mt-3 text-3xl font-black">
      {currentTeam.hitZeroRate}%
    </div>
  </div>
</div>

<div className="mt-8 border-t border-slate-200 pt-8">
  <div className="grid grid-cols-3 gap-6 text-center">
    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl bg-slate-50/70 p-4">
      <div className="text-sm font-semibold text-slate-600">Best Score</div>
      <div className="mt-3 text-3xl font-black">
        {fmtScore(currentTeam.bestScore)}
      </div>
      <div className="text-sm text-slate-500">{bestScoreDate}</div>
    </div>

    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl bg-slate-50/70 p-4">
      <div className="text-sm font-semibold text-slate-600">Total Events</div>
      <div className="mt-3 text-3xl font-black">
        {currentTeam.totalEvents}
      </div>
    </div>

    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl bg-slate-50/70 p-4">
      <div className="text-sm font-semibold text-slate-600">Avg Event Size</div>



      <div className="mt-2 text-3xl font-black">
        {currentTeam.avgEventSize}
      </div>

      <div className="text-xs text-slate-500">Avg Teams per Comp</div>
    </div>
  </div>
</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
