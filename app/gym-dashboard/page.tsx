"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { usePathname } from "next/navigation";
import GymDashboardSidebar from "@/app/gym-dashboard/components/GymDashboardSidebar";
import { getActiveGymOrganization } from "@/lib/gym-dashboard/getActiveOrganization";

type Performance = {
  round_phase: string;
  raw_score: number | null;
  deductions: number | null;
  performance_score: number | null;
  hit_zero: boolean;
};

type TeamRow = {
  team_id: string;
  team: string;
  division: string;
  event_name: string;
  weekend_date: string;
  event_score: number | null;
  performance_count: number;
  hit_zero_count: number;
  hit_zero_rate: number;
  event_team_count: number | null;
  performances: Performance[];
  organization_name: string;
};

type TopScore = {
  team: string;
  division: string;
  event_name: string;
  weekend_date: string;
  event_score: number;
  event_team_count: number | null;
  organization_name: string;
};

type HitZeroSummary = {
  performance_count: number;
  hit_zero_count: number;
  hit_zero_rate: number;
};

type DeltaCard = {
  team: string;
  division: string;
  event_name: string;
  weekend_date: string;
  event_score: number;
  prior_event_name: string;
  prior_event_score: number;
  event_score_delta: number;
  event_team_count: number | null;
};

type CompRow = {
  event_id?: string;
  event_name: string;
  weekend_date: string;
  event_team_count: number | null;
  gym_team_count: number;
};

type StreakRow = {
  team_id: string;
  team: string;
  division: string;
  active_hit_zero_event_streak: number;
};

type SlumpRow = {
  team_id: string;
  team: string;
  division: string;
  active_hit_zero_slump: number;
};

type DivisionLeader = {
  ranking_group: string;
  program: string;
  team: string;
  display_size_effective: string | null;
  avg_event_score: number;
};

type NationalPercentileRow = {
  team: string | null;
  team_id: string;
  division: string;
  avg_event_score: number;
  season_events: number;
  team_count: number;
  national_percentile: number;
  top_percent: number;
};

function percentileColorClass(percentile: number) {
  if (percentile < 50) return "text-red-400";
  if (percentile === 50) return "text-yellow-300";
  return "text-emerald-400";
}

function ordinal(n: number) {
  const j = n % 10;
  const k = n % 100;

  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;

  return `${n}th`;
}
function fmtScore(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(3);
}

function fmtDelta(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${Number(value).toFixed(3)}`;
}

function fmtDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
}

function eventStars(count?: number | null) {
  if (!count || count <= 0) return "—";
  if (count < 100) return "⭐";
  if (count < 250) return "⭐⭐";
  if (count < 500) return "⭐⭐⭐";
  return "⭐⭐⭐⭐";
}

function eventSizeLabel(count?: number | null) {
  if (!count || count <= 0) return "";
  return `(${count})`;
}

export default function GymDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [teamRows, setTeamRows] = useState<TeamRow[]>([]);
  const [topScore, setTopScore] = useState<TopScore | null>(null);
  const [hitZero, setHitZero] = useState<HitZeroSummary | null>(null);
  const [riser, setRiser] = useState<DeltaCard | null>(null);
  const [faller, setFaller] = useState<DeltaCard | null>(null);
  const [comps, setComps] = useState<CompRow[]>([]);
  const [streaks, setStreaks] = useState<StreakRow[]>([]);
  const [slumps, setSlumps] = useState<SlumpRow[]>([]);
  const [leaders, setLeaders] = useState<DivisionLeader[]>([]);
  const [nationalPercentiles, setNationalPercentiles] = useState<NationalPercentileRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        setError("Please log in to view your Gym Dashboard.");
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
  return;
}

if (!activeOrganization) {
  setError("Gym Dashboard access is not active for this account.");
  return;
}

setOrgName(activeOrganization.organizationName);

const organizationId = activeOrganization.organizationId;

const [
  teamTableRes,
  topScoreRes,
  hitZeroRes,
  riserRes,
  fallerRes,
  compsRes,
  streaksRes,
  slumpRes,
  divisionLeadersRes,
  nationalPercentileRes,
] = await Promise.all([
  supabase
    .from("v_gym_overview_team_table_live")
    .select("*")
    .eq("organization_id", organizationId)
    .order("event_score", { ascending: false }),

  supabase
    .from("v_gym_overview_top_scoring_team_live")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle(),

  supabase
    .from("v_gym_overview_hit_zero_summary_live")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle(),

  supabase
    .from("v_gym_overview_biggest_riser_live")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle(),

  supabase
    .from("v_gym_overview_biggest_faller_live")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle(),

  supabase
    .from("v_gym_overview_comps_live")
    .select("*")
    .eq("organization_id", organizationId)
    .order("weekend_date", { ascending: false }),

  supabase
    .from("v_gym_overview_hit_zero_streaks_live")
    .select("*")
    .eq("organization_id", organizationId)
    .gt("active_hit_zero_event_streak", 0)
    .order("active_hit_zero_event_streak", { ascending: false }),

  supabase
    .from("v_gym_overview_hit_zero_slump_live")
    .select("*")
    .eq("organization_id", organizationId)
    .order("active_hit_zero_slump", { ascending: false }),

  supabase
    .from("v_gym_overview_division_leaders_live")
    .select("ranking_group, program, team, display_size_effective, avg_event_score")
    .eq("organization_id", organizationId)
    .order("ranking_group"),

  Promise.resolve({ data: [], error: null }),
]);
      const firstError =
        teamTableRes.error ||
        topScoreRes.error ||
        hitZeroRes.error ||
        riserRes.error ||
        fallerRes.error ||
        compsRes.error ||
        streaksRes.error ||
        slumpRes.error ||
        divisionLeadersRes.error;

      if (firstError) {
        setError(firstError.message);
        return;
      }

      setTeamRows((teamTableRes.data ?? []) as TeamRow[]);
      const teamRowsData = (teamTableRes.data ?? []) as any[];

const teamIds = Array.from(
  new Set(
    teamRowsData
      .map((r) => String(r.team_id))
      .filter((id) => id && id !== "undefined" && id !== "null")
  )
);

const teamNameById = new Map(
  teamRowsData.map((r) => [String(r.team_id), r.team])
);


if (teamIds.length > 0) {
  const { data: percentileData, error: percentileError } = await supabase
    .from("mv_gym_dashboard_team_percentile")
    .select(
  "team_id, division, avg_event_score, season_events, team_count, national_percentile, top_percent"
)
    .in("team_id", teamIds)
    .order("top_percent", { ascending: true });



  if (percentileError) {
    setNationalPercentiles([]);
  } else {
    const percentilesWithTeam = (percentileData ?? []).map((row) => ({
      ...row,
      team: teamNameById.get(String(row.team_id)) ?? "—",
    }));

    setNationalPercentiles(percentilesWithTeam as NationalPercentileRow[]);
  }
} else {
  setNationalPercentiles([]);
}

setTopScore(topScoreRes.data as TopScore | null);
setHitZero(hitZeroRes.data as HitZeroSummary | null);
setRiser(riserRes.data as DeltaCard | null);
setFaller(fallerRes.data as DeltaCard | null);
setComps((compsRes.data ?? []) as CompRow[]);
setStreaks((streaksRes.data ?? []) as StreakRow[]);
setSlumps((slumpRes.data ?? []) as SlumpRow[]);
setLeaders((divisionLeadersRes.data ?? []) as DivisionLeader[]);

} catch (err) {
  setError(err instanceof Error ? err.message : "Failed to load Gym Dashboard.");
} finally {
  setLoading(false);
}
}

loadDashboard();
}, []);

const [orgName, setOrgName] = useState("Gym Dashboard");

  const updatedThrough = useMemo(() => {
  const dates = teamRows
    .map((r) => r.weekend_date)
    .filter(Boolean)
    .sort();

  if (!dates.length) return "—";

  return fmtDate(dates[dates.length - 1]);
}, [teamRows]);


  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#06111d] text-slate-100">
        <div className="rounded-2xl border border-white/10 bg-[#0b1b2a] px-6 py-4 text-sm text-slate-300">
          Loading Gym Dashboard…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#06111d] p-8 text-slate-100">
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
            <h1 className="text-3xl font-bold tracking-tight">Gym Overview - Weekly Recap</h1>
            <p className="mt-1 text-sm text-slate-400">
              Your teams. Your data. Your advantage.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl border border-white/10 bg-[#0b1b2a] px-4 py-2 text-sm font-medium text-slate-200">
              {`Updated Through ${updatedThrough}`}
            </button>

            <button className="rounded-xl border border-white/10 bg-[#0b1b2a] px-4 py-2 text-sm font-medium text-slate-200">
              Filters
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-5 gap-4">
          <MetricCard
            label="Top Scoring Team This Week"
            title={topScore?.team ?? "—"}
            value={fmtScore(topScore?.event_score)}
            sub={topScore?.division}
            meta={topScore?.event_name}
            stars={eventStars(topScore?.event_team_count)}
          />

          <MetricCard
            label="Biggest Riser This Week"
            title={riser?.team ?? "—"}
            value={fmtDelta(riser?.event_score_delta)}
            sub={
              riser
                ? `${fmtScore(riser.prior_event_score)} → ${fmtScore(
                    riser.event_score
                  )}`
                : ""
            }
            meta={riser ? `vs ${riser.prior_event_name}` : ""}
            positive
          />

          <MetricCard
            label="Weekend Hit Zero Rate"
            title={`${hitZero?.hit_zero_rate ?? 0}%`}
            value={`${hitZero?.hit_zero_count ?? 0} of ${
              hitZero?.performance_count ?? 0
            }`}
            sub="performances"
          />

          <MetricCard
            label="Biggest Faller This Week"
            title={faller?.team ?? "—"}
            value={fmtDelta(faller?.event_score_delta)}
            sub={
              faller
                ? `${fmtScore(faller.prior_event_score)} → ${fmtScore(
                    faller.event_score
                  )}`
                : ""
            }
            meta={faller ? `vs ${faller.prior_event_name}` : ""}
            negative
          />

          <div className="min-h-[150px] rounded-2xl border border-white/10 bg-[#0b1b2a] p-4 text-center shadow-2xl shadow-black/20">
  <div className="text-[10px] uppercase tracking-wide text-slate-500">
    Top Percentile Team
  </div>

  {nationalPercentiles[0] ? (
    <>
      <div className="mt-3 line-clamp-2 text-xl font-bold leading-tight tracking-tight text-white">
        {nationalPercentiles[0].team}
      </div>

      <div className="mt-1 text-2xl font-black tracking-tight text-cyan-400">
        {ordinal(
  Math.round(100 - Number(nationalPercentiles[0].top_percent ?? 0))
)}
      </div>

      <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-slate-400">
        Percentile
      </div>
<div className="mt-3 px-4">
  <div className="relative h-2 rounded-full bg-slate-700">
    <div
      className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-cyan-400 ring-2 ring-[#0b1b2a]"
      style={{
        left: `${Math.round(
          100 - Number(nationalPercentiles[0].top_percent ?? 0)
        )}%`,
        transform: "translate(-50%, -50%)",
      }}
    />
  </div>

  <div className="mt-1 flex justify-between text-[10px] text-slate-500">
    <span>Bottom</span>
    <span>Elite</span>
  </div>
</div>
      <div className="mt-2 text-xs font-medium text-slate-300">
        {nationalPercentiles[0].division}
      </div>

      <div className="mt-1 text-[11px] text-slate-500">
        {nationalPercentiles[0].team_count} teams tracked
      </div>
    </>
  ) : (
    <div className="mt-4 text-sm text-slate-500">No percentile data</div>
  )}
</div>

          
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-5">
          <div className="min-w-0 space-y-5">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1b2a] shadow-2xl shadow-black/20">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-2xl font-bold">
  Weekend Recap — {updatedThrough}
</h2>

                    <p className="text-sm text-slate-400">
                      Latest regular-season competition per team
                    </p>
                  </div>

                  <div className="text-xs text-slate-500">
                    Scores are ECS normalized regular-season results
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-4 text-left">Team</th>
                      <th className="px-4 py-4 text-left">Division</th>
                      <th className="px-4 py-4 text-left">Comp</th>
                      <th className="px-4 py-4 text-center">Event Score</th>
                      <th className="px-4 py-4 text-center">Hit Zero</th>
                      <th className="px-4 py-4 text-left">Performances</th>
                    </tr>
                  </thead>

                  <tbody>
                    {teamRows.map((row) => (
                      <tr
                        key={`${row.team_id}-${row.event_name}`}
                        className="border-t border-white/5"
                      >
                        <td className="px-4 py-5">
                          <div className="font-semibold text-white">
                            {row.team}
                          </div>
                        </td>

                        <td className="px-4 py-5 text-slate-300">
                          {row.division}
                        </td>

                        <td className="px-4 py-5">
                          <div className="font-medium text-white">
                            {row.event_name}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            <span className="text-yellow-400">
                              {eventStars(row.event_team_count)}
                            </span>{" "}
                            {eventSizeLabel(row.event_team_count)}
                          </div>
                        </td>

                        <td className="px-4 py-5 text-center">
                          <div className="text-xl font-bold tracking-tight text-white">
                            {fmtScore(row.event_score)}
                          </div>
                        </td>

                        <td className="px-4 py-5 text-center">
                          <div className="font-bold text-white">
                            {row.hit_zero_count}/{row.performance_count}
                          </div>

                          <div className="text-xs text-slate-400">
                            {row.hit_zero_rate}%
                          </div>
                        </td>

                        <td className="px-4 py-5">
                          <div className="flex flex-wrap gap-2">
                            {row.performances?.map((p, idx) => (
                              <div
                                key={`${row.team_id}-${idx}`}
                                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                              >
                                <div className="text-xs text-slate-400">
                                  {p.round_phase}
                                </div>

                                <div className="mt-1 flex items-center gap-2">
                                  <span className="font-bold text-white">
                                    {fmtScore(p.performance_score)}
                                  </span>

                                  {p.hit_zero ? (
                                    <span className="text-xs font-semibold text-emerald-400">
                                      HZ
                                    </span>
                                  ) : (
                                    <span className="text-xs font-semibold text-red-400">
                                      {p.deductions} ded
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs text-slate-400">
                <div>
                  Event Size Key:{" "}
                  <span className="text-yellow-400">⭐</span> &lt;100 ·{" "}
                  <span className="text-yellow-400">⭐⭐</span> 100–249 ·{" "}
                  <span className="text-yellow-400">⭐⭐⭐</span> 250–499 ·{" "}
                  <span className="text-yellow-400">⭐⭐⭐⭐</span> 500+
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#0b1b2a] p-5 shadow-2xl shadow-black/20">
              <div className="flex items-end justify-between gap-3">
  <div>
    <h2 className="text-2xl font-semibold">
      Division Leaders — Nationally
    </h2>

    <p className="mt-1 text-sm text-slate-400">
      Top averages in divisions your gym participates in
    </p>
  </div>

  <div className="text-xs text-slate-500">
    Updated through {updatedThrough}
  </div>
</div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {leaders.map((leader) => (
                  <div
                    key={`${leader.ranking_group}-${leader.program}-${leader.team}`}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center"
                  >
                    <div className="text-xs uppercase tracking-wide text-slate-400">
  {leader.display_size_effective
    ? `${leader.ranking_group} — ${leader.display_size_effective}`
    : leader.ranking_group}
</div>

{!leader.display_size_effective && (
  <div className="mt-1 text-[11px] text-slate-500">
    Leader shown without size category
  </div>
)}

                    <div className="mt-4 text-xl font-semibold text-white">
                      {leader.program}
                    </div>

                    <div className="text-lg font-semibold text-slate-300">
                      {leader.team}
                    </div>

                    <div className="mt-5 text-4xl font-bold text-white">
                      {fmtScore(leader.avg_event_score)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <SideCard
              title="Hit Zero Streaks"
              subtitle="Consecutive hit-zero events"
            >
              <div className="space-y-4">
                {streaks.slice(0, 5).map((s) => (
                  <div
                    key={`${s.team_id}-${s.division}`}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-white">{s.team}</div>

                      <div className="text-sm text-slate-400">
                        {s.division}
                      </div>
                    </div>

                    <div className="text-2xl font-bold text-white">
                      {s.active_hit_zero_event_streak}
                    </div>
                  </div>
                ))}
              </div>
            </SideCard>

            <SideCard
              title="Hit Zero Slump"
              subtitle="Consecutive events without fully hitting zero"
            >
              <div className="space-y-4">
                {slumps.slice(0, 5).map((s) => (
                  <div
                    key={`${s.team_id}-${s.division}`}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-white">{s.team}</div>

                      <div className="text-sm text-slate-400">
                        {s.division}
                      </div>
                    </div>

                    <div className="text-2xl font-bold text-red-400">
                      {s.active_hit_zero_slump}
                    </div>
                  </div>
                ))}
              </div>
            </SideCard>

            <SideCard
              title="National Percentile by Division"
              subtitle="Regular-season national standing"
            >
              <div className="space-y-4">
                {nationalPercentiles.map((r) => {
  const percentile = Math.round(100 - Number(r.top_percent ?? 0));

  return (
  <div
  key={`${r.team_id}-${r.division}`}
  className="space-y-1"
>
  <div className="flex items-start justify-between gap-4">
    <div>
      <div className="font-semibold text-white">
        {r.team}
      </div>

      <div
  className="truncate whitespace-nowrap text-[11px] text-slate-400"
  title={r.division}
>
  {r.division}
</div>
    </div>

    <div
  className={`shrink-0 whitespace-nowrap text-right text-lg font-bold ${percentileColorClass(percentile)}`}
>
  {ordinal(percentile)} Percentile
</div>
  </div>

  <div className="text-center text-[11px] text-slate-500">
    Better than {percentile}% of teams
  </div>
</div>
);
})}
              </div>
            </SideCard>
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarItem({
  label,
  active,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
        active
          ? "bg-blue-600 text-white"
          : "text-slate-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function MetricCard({
  label,
  title,
  value,
  sub,
  meta,
  stars,
  positive,
  negative,
}: {
  label: string;
  title: string;
  value: string;
  sub?: string;
  meta?: string;
  stars?: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="min-h-[150px] rounded-2xl border border-white/10 bg-[#0b1b2a] p-4 text-center shadow-2xl shadow-black/20">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div
        className={`mt-2 line-clamp-2 text-xl font-bold leading-tight tracking-tight ${
          positive
            ? "text-emerald-400"
            : negative
            ? "text-red-400"
            : "text-white"
        }`}
      >
        {title}
      </div>

      <div
        className={`mt-1 text-2xl font-black tracking-tight ${
          positive
            ? "text-emerald-400"
            : negative
            ? "text-red-400"
            : "text-white"
        }`}
      >
        {value}
      </div>

      {sub && (
        <div className="mt-2 text-xs font-medium text-slate-300">
          {sub}
        </div>
      )}

      {meta && (
        <div className="mt-1 line-clamp-1 text-[11px] text-slate-500">
          {meta}
        </div>
      )}

      {stars && (
        <div className="mt-2 text-base text-yellow-400">{stars}</div>
      )}
    </div>
  );
}
function SideCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b1b2a] p-5 shadow-2xl shadow-black/20">
      <h3 className="text-2xl font-semibold text-white">{title}</h3>

      {subtitle && (
        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
          {subtitle}
        </p>
      )}

      <div className="mt-5">{children}</div>
    </section>
  );
}