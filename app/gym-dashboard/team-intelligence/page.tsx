"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import GymDashboardSidebar from "@/app/gym-dashboard/components/GymDashboardSidebar";



type TeamOption = {
  team_id: string;
  team: string;
  division: string;
  organization_name: string;
};

type EventRow = {
  event_id: string;
  event_name: string;
  weekend_date: string;
  event_score: number | null;
  ceiling_score: number | null;
  event_team_count: number | null;
  performance_count: number | null;
  hit_zero_count: number | null;
  hit_zero_rate: number | null;
};

type PercentileRow = {
  team_id: string;
  division: string;
  avg_event_score: number | null;
  season_events: number | null;
  team_count: number | null;
  national_percentile: number | null;
  top_percent: number | null;
};

type ChartRow = {
  date: string;
  eventDate: string;
  event: string;
  ecsScore: number;
  ceiling: number;
  eventTeamCount: number | null;
};

function fmtScore(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(3);
}

function fmtPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(1)}%`;
}

function percentileRank(row?: PercentileRow | null) {
  if (!row?.top_percent && row?.top_percent !== 0) return null;
  return Math.round(100 - Number(row.top_percent));
}

function ordinal(n: number) {
  const j = n % 10;
  const k = n % 100;

  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;

  return `${n}th`;
}

function fmtDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
}

function shortDate(value?: string | null) {
  if (!value) return "";
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function eventStars(count?: number | null) {
  if (!count || count <= 0) return "—";
  if (count < 100) return "⭐";
  if (count < 250) return "⭐⭐";
  if (count < 500) return "⭐⭐⭐";
  return "⭐⭐⭐⭐";
}

function percentileColorClass(percentile: number) {
  if (percentile < 50) return "text-red-400";
  if (percentile === 50) return "text-yellow-300";
  return "text-emerald-400";
}

function hitZeroColorClass(rate?: number | null) {
  if (rate === null || rate === undefined) return "text-yellow-300";
  if (rate < 50) return "text-red-400";
  if (rate <= 75) return "text-yellow-300";
  return "text-emerald-400";
}

function avg(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function TeamIntelligencePage() {
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [percentile, setPercentile] = useState<PercentileRow | null>(null);
  const [orgName, setOrgName] = useState("Gym Dashboard");

  useEffect(() => {
  async function loadTeams() {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      setError("Please log in to view Team Intelligence.");
      setLoading(false);
      return;
    }

    const { data: membership } = await supabase
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

    const organization = (
      Array.isArray(membership?.organizations)
        ? membership.organizations[0]
        : membership?.organizations
    ) as {
      id: string;
      name: string;
      subscription_status: string;
    } | null;

    if (!membership || organization?.subscription_status !== "active") {
      setError("Gym Dashboard access is not active for this account.");
      setLoading(false);
      return;
    }

    setOrgName(organization.name);

    const { data, error } = await supabase
      .from("v_gym_overview_team_table")
      .select("team_id, team, division, organization_name")
      .eq("organization_id", membership.organization_id)
      .order("team", { ascending: true });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const unique = new Map<string, TeamOption>();

    (data ?? []).forEach((row: TeamOption) => {
      if (!unique.has(row.team_id)) unique.set(row.team_id, row);
    });

    const teamList = Array.from(unique.values());

    setTeams(teamList);
    setSelectedTeamId(teamList[0]?.team_id ?? "");
    setLoading(false);
  }

  loadTeams();
}, []);

  useEffect(() => {
    async function loadEvents() {
      if (!selectedTeamId) return;

      setLoadingEvents(true);
      setError(null);

      const { data, error } = await supabase
        .from("mv_gym_team_event_history")
        .select(
          "event_id, event_name, weekend_date, event_score, ceiling_score, event_team_count, performance_count, hit_zero_count, hit_zero_rate"
        )
        .eq("team_id", selectedTeamId)
        .order("weekend_date", { ascending: true });

      if (error) {
        setError(error.message);
        setEvents([]);
        setPercentile(null);
        setLoadingEvents(false);
        return;
      }

const { data: percentileData, error: percentileError } = await supabase
  .from("mv_gym_dashboard_team_percentile")
  .select(
  "team_id, division, avg_event_score, season_events, team_count, national_percentile, top_percent"
)
  .eq("team_id", selectedTeamId)
  .limit(1);

if (percentileError) {
  console.error("National percentile query failed:", percentileError);
  setPercentile(null);
} else {

  setPercentile((percentileData?.[0] as PercentileRow) ?? null);
}

      setEvents((data ?? []) as EventRow[]);
      setLoadingEvents(false);
    }

    loadEvents();
  }, [selectedTeamId]);

  const selectedTeam = teams.find((team) => team.team_id === selectedTeamId) ?? null;

  const chartData: ChartRow[] = useMemo(() => {
    return events
      .filter((row) => row.event_score !== null && row.ceiling_score !== null)
      .map((row) => ({
        date: shortDate(row.weekend_date),
        eventDate: fmtDate(row.weekend_date),
        event: row.event_name,
        ecsScore: Number(row.event_score),
        ceiling: Number(row.ceiling_score),
        eventTeamCount: row.event_team_count,
      }));
  }, [events]);

  const stats = useMemo(() => {
    const validScores = events
      .map((row) => (row.event_score === null ? null : Number(row.event_score)))
      .filter((value): value is number => value !== null && !Number.isNaN(value));

    const validCeilings = events
      .map((row) => (row.ceiling_score === null ? null : Number(row.ceiling_score)))
      .filter((value): value is number => value !== null && !Number.isNaN(value));

    const validEventSizes = events
      .map((row) => (row.event_team_count === null ? null : Number(row.event_team_count)))
      .filter((value): value is number => value !== null && !Number.isNaN(value));

    const avgScore = avg(validScores);
    const avgCeiling = avg(validCeilings);
    const avgEventSize = avg(validEventSizes);

    const sortedByScore = [...events]
      .filter((row) => row.event_score !== null)
      .sort((a, b) => Number(b.event_score) - Number(a.event_score));

    const sortedByDate = [...events].sort((a, b) =>
      String(a.weekend_date).localeCompare(String(b.weekend_date))
    );

    const latestEvent = sortedByDate[sortedByDate.length - 1] ?? null;
    const topEvent = sortedByScore[0] ?? null;

    const totalPerformances = events.reduce(
      (sum, row) => sum + Number(row.performance_count ?? 0),
      0
    );

    const totalHitZero = events.reduce(
      (sum, row) => sum + Number(row.hit_zero_count ?? 0),
      0
    );

    const seasonHitZeroRate =
      totalPerformances > 0 ? (totalHitZero / totalPerformances) * 100 : null;

    return {
      avgScore,
      avgCeiling,
      avgEventSize,
      seasonEvents: events.length,
      topEvent,
      latestEvent,
      totalPerformances,
      totalHitZero,
      seasonHitZeroRate,
      scoringGap:
        avgScore !== null && avgCeiling !== null ? Math.max(0, avgCeiling - avgScore) : null,
      ceilingConversion:
        avgScore !== null && avgCeiling !== null && avgCeiling > 0
          ? (avgScore / avgCeiling) * 100
          : null,
    };
  }, [events]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06111d] text-slate-100">
        Loading Team Intelligence...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06111d] p-8 text-slate-100">
        <div className="max-w-xl rounded-2xl border border-red-500/30 bg-red-950/20 p-6 text-red-200">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-[#06111d] text-slate-100">
      <GymDashboardSidebar organizationName={orgName} />

      <main className="ml-64 min-w-0 flex-1 overflow-x-hidden p-6 xl:p-8">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Intelligence</h1>
            <p className="mt-1 text-sm text-slate-400">
              Team-level trends, ceiling, scoring profile, and event context.
            </p>
          </div>

          <button className="rounded-xl border border-white/10 bg-[#0b1b2a] px-4 py-2 text-sm font-medium text-slate-200">
            Export PDF
          </button>
        </div>

        <section className="mb-5 rounded-2xl border border-white/10 bg-[#0b1b2a] p-5 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="text-sm font-semibold text-white">Select Team</div>

            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="min-w-[320px] rounded-xl border border-white/10 bg-[#101f30] px-4 py-3 text-sm text-white outline-none"
            >
              {teams.map((team) => (
                <option key={team.team_id} value={team.team_id}>
                  {team.team} — {team.division}
                </option>
              ))}
            </select>

            {selectedTeam && (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300">
                ● Active
              </div>
            )}

            {loadingEvents && (
              <div className="text-sm text-slate-400">Loading events...</div>
            )}
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-white/10 bg-[#0b1b2a] p-5 shadow-2xl shadow-black/20">
          <div className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-200">
            Team Snapshot
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SnapshotCard
              label="ECS Avg Score"
              value={fmtScore(stats.avgScore)}
              sub="Regular season average"
            />
            <SnapshotCard
              label="Avg Ceiling Score"
              value={fmtScore(stats.avgCeiling)}
              sub="Expected scoring upside"
            />
            <SnapshotCard
              label="Potential Upside"
              value={fmtScore(stats.scoringGap)}
              sub="Avg ceiling − Avg score = Scoring Gap"
            />
            <SnapshotCard
              label="Top Event Score"
              value={fmtScore(stats.topEvent?.event_score)}
              sub={
                stats.topEvent
                  ? `${stats.topEvent.event_name} · ${fmtDate(stats.topEvent.weekend_date)}`
                  : "—"
              }
              stars={eventStars(stats.topEvent?.event_team_count)}
            />
            <SnapshotCard
  label="Latest Score"
  value={fmtScore(stats.latestEvent?.event_score)}
  sub={
    stats.latestEvent
      ? `${stats.latestEvent.event_name} · ${fmtDate(
          stats.latestEvent.weekend_date
        )}`
      : "—"
  }
  stars={eventStars(stats.latestEvent?.event_team_count)}
/>
          </div>
        </section>

       <section className="mb-5 rounded-2xl border border-white/10 bg-[#0b1b2a] p-5 shadow-2xl shadow-black/20">
  <div className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-200">
    Intelligence Summary
  </div>

  {(() => {
    const percentileValue =
      percentile?.top_percent !== null && percentile?.top_percent !== undefined
        ? Math.round(100 - Number(percentile.top_percent))
        : null;

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <div className="text-sm font-bold text-emerald-400">Season Events</div>
          <div className="mt-4 text-4xl font-black text-white">
            {stats.seasonEvents}
          </div>
          <div className="mt-2 text-sm text-slate-400">
            Regular-season events
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <div className="text-sm font-bold text-yellow-400">Avg Event Size</div>
          <div className="mt-4 text-xl tracking-[0.2em] text-yellow-300">
            {stats.avgEventSize ? eventStars(stats.avgEventSize) : "—"}
          </div>
          <div className="mt-3 text-4xl font-black text-white">
            {stats.avgEventSize ? Math.round(stats.avgEventSize) : "—"}
          </div>
          <div className="mt-2 text-sm text-slate-400">Avg Teams per Comp</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <div className="text-sm font-bold text-orange-400">
            National Percentile
          </div>

          <div className="mt-1 text-xs text-slate-400">
            {percentile?.division ?? "—"}
          </div>

          {percentileValue !== null ? (
            <>
              <div
                className={`mt-3 text-4xl font-black ${percentileColorClass(
                  percentileValue
                )}`}
              >
                {ordinal(percentileValue)}
              </div>

              <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-slate-400">
                Percentile
              </div>

              <div className="mt-3 px-4">
                <div className="relative h-2 rounded-full bg-slate-700">
                  <div
                    className="absolute top-1/2 h-4 w-4 rounded-full bg-cyan-400 ring-2 ring-[#0b1b2a]"
                    style={{
                      left: `${percentileValue}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                </div>

                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                  <span>Bottom</span>
                  <span>Elite</span>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-400">
                Better than {percentileValue}% of teams
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {percentile?.team_count ?? "—"} teams tracked
              </div>
            </>
          ) : (
            <div className="mt-4 text-sm text-slate-500">
              Percentile unavailable
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <div className="text-sm font-bold text-violet-400">Hit Zero Rate</div>

          {stats.seasonHitZeroRate === null ? (
            <div className="mt-4 text-sm text-slate-500">
              Hit-zero data unavailable
            </div>
          ) : (
            <>
              <div
                className={`mt-4 text-4xl font-black ${hitZeroColorClass(
                  stats.seasonHitZeroRate
                )}`}
              >
                {fmtPercent(stats.seasonHitZeroRate)}
              </div>

              <div className="mt-2 text-sm text-slate-400">
                {stats.totalHitZero} of {stats.totalPerformances}
              </div>

              <div className="mt-1 text-sm text-slate-500">
                performances hit zero
              </div>
            </>
          )}
        </div>
      </div>
    );
  })()}
</section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(560px,0.9fr)]">
          <section className="rounded-2xl border border-white/10 bg-[#0b1b2a] p-5 shadow-2xl shadow-black/20">
            <h2 className="text-lg font-semibold">Score Trend</h2>
            <p className="text-sm text-slate-400">ECS Score vs Ceiling Score</p>

            {chartData.length > 1 ? (
              <ScoreChart data={chartData} />
            ) : (
              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
                Not enough event history to display a trend chart.
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1b2a] shadow-2xl shadow-black/20">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold">Event History</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-4 text-left">Date</th>
                    <th className="px-4 py-4 text-left">Event</th>
                    <th className="px-4 py-4 text-center">ECS Score</th>
                    <th className="px-4 py-4 text-center">Ceiling</th>
                    <th className="px-4 py-4 text-center">ECS Event Size</th>
                  </tr>
                </thead>

                <tbody>
                  {[...events].reverse().map((row) => (
                    <tr key={`${row.event_id}-${row.weekend_date}`} className="border-t border-white/5">
                      <td className="px-4 py-4 text-slate-300">{fmtDate(row.weekend_date)}</td>
                      <td className="px-4 py-4 font-medium text-white">{row.event_name}</td>
                      <td className="px-4 py-4 text-center font-bold text-white">
                        {fmtScore(row.event_score)}
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-slate-300">
                        {fmtScore(row.ceiling_score)}
                      </td>
                      <td className="px-4 py-4 text-center text-yellow-400">
                        {eventStars(row.event_team_count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Event Size Key: <span className="text-yellow-400">⭐</span> &lt;100 ·{" "}
          <span className="text-yellow-400">⭐⭐</span> 100–249 ·{" "}
          <span className="text-yellow-400">⭐⭐⭐</span> 250–499 ·{" "}
          <span className="text-yellow-400">⭐⭐⭐⭐</span> 500+
        </div>
      </main>
    </div>
  );
}

function SidebarItem({
  label,
  active,
  href,
}: {
  label: string;
  active?: boolean;
  href?: string;
}) {
  const className = `block w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
    active
      ? "bg-blue-600 text-white"
      : "text-slate-300 hover:bg-white/5 hover:text-white"
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <button className={className} type="button">
      {label}
    </button>
  );
}

function SnapshotCard({
  label,
  value,
  sub,
  stars,
}: {
  label: string;
  value: string;
  sub?: string;
  stars?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
      <div className="text-[11px] font-bold uppercase tracking-wide text-cyan-300">
        {label}
      </div>
      <div className="mt-3 text-3xl font-black tracking-tight text-white">
        {value}
      </div>
      {sub && (
  <div className="mt-2 text-xs text-slate-400">
    {sub}
  </div>
)}

{stars && (
  <div className="mt-2 text-sm tracking-[0.2em] text-yellow-300">
    {stars}
  </div>
)}
    </div>
  );
}

function SummaryCard({
  title,
  body,
  tone,
  stars,
}: {
  title: string;
  body: string;
  tone: "green" | "yellow" | "orange" | "purple";
  stars?: string;
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-400"
      : tone === "yellow"
        ? "text-yellow-400"
        : tone === "orange"
          ? "text-orange-400"
          : "text-violet-400";

return (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    <div className={`font-bold ${toneClass}`}>{title}</div>

    <div className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">
  {body}
</div>

    {stars && (
      <div className="mt-2 text-sm tracking-[0.2em] text-yellow-300">
        {stars}
      </div>
    )}
  </div>
);
}
function ScoreChart({ data }: { data: ChartRow[] }) {
  const [hovered, setHovered] = useState<ChartRow | null>(null);

  const width = 720;
  const height = 360;
  const pad = 46;

  const allValues = data.flatMap((row) => [row.ecsScore, row.ceiling]);
  const minRaw = Math.min(...allValues);
  const maxRaw = Math.max(...allValues);
  const minY = Math.floor(minRaw - 1);
  const maxY = Math.ceil(maxRaw + 1);
  const range = Math.max(1, maxY - minY);

  function x(index: number) {
    if (data.length <= 1) return width / 2;
    return pad + (index / (data.length - 1)) * (width - pad * 2);
  }

  function y(value: number) {
    return height - pad - ((value - minY) / range) * (height - pad * 2);
  }

  const scorePoints = data
    .map((row, index) => `${x(index)},${y(row.ecsScore)}`)
    .join(" ");

  const ceilingPoints = data
    .map((row, index) => `${x(index)},${y(row.ceiling)}`)
    .join(" ");

  const ticks = [minY, Math.round((minY + maxY) / 2), maxY];

  return (
    <div className="relative w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[360px] min-w-[640px] w-full">
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad}
              x2={width - pad}
              y1={y(tick)}
              y2={y(tick)}
              stroke="rgba(255,255,255,0.08)"
            />
            <text x={12} y={y(tick) + 4} fill="rgba(226,232,240,0.75)" fontSize="12">
              {tick}
            </text>
          </g>
        ))}

        <polyline
          points={ceilingPoints}
          fill="none"
          stroke="rgba(203,213,225,0.85)"
          strokeWidth="4"
          strokeDasharray="12 14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <polyline
          points={scorePoints}
          fill="none"
          stroke="rgb(139,92,246)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((row, index) => (
          <g key={`${row.date}-${row.event}`}>
            <circle
              cx={x(index)}
              cy={y(row.ecsScore)}
              r="7"
              fill="rgb(139,92,246)"
              stroke="rgb(196,181,253)"
              strokeWidth="2"
              onMouseEnter={() => setHovered(row)}
              onMouseLeave={() => setHovered(null)}
            />
            <text
              x={x(index)}
              y={height - 18}
              textAnchor="middle"
              fill="rgba(226,232,240,0.75)"
              fontSize="11"
            >
              {row.date}
            </text>
          </g>
        ))}
      </svg>

      {hovered && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-[#050b16] p-4 text-sm shadow-2xl">
          <div className="font-semibold text-white">{hovered.event}</div>
          <div className="mt-1 text-xs text-slate-400">{hovered.eventDate}</div>

          <div className="mt-3 space-y-1">
            <div className="text-violet-300">
              ECS Score: {fmtScore(hovered.ecsScore)}
            </div>
            <div className="text-cyan-300">
              Ceiling Score: {fmtScore(hovered.ceiling)}
            </div>
            <div className="text-yellow-300">
              ECS Event Size: {eventStars(hovered.eventTeamCount)}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="h-[2px] w-8 rounded bg-violet-400" />
          ECS Score
        </div>
        <div className="flex items-center gap-2">
          <span className="h-[2px] w-8 border-t-2 border-dashed border-slate-300" />
          Ceiling
        </div>
      </div>
    </div>
  );
}