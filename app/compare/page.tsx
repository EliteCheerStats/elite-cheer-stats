"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PremiumGate from "@/app/components/PremiumGate";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";

type TeamOption = {
  team_id: string;
  program: string | null;
  team: string | null;
  division: string | null;
};

type EventRow = {
  team_id: string;
  program: string | null;
  team: string | null;
  event_id: string;
  event_name: string | null;
  weekend_date: string | null;
  division: string | null;
  event_score: number | null;
};

type CeilingRow = {
  team_id: string;
  event_id: string;
  ceiling_score: number | null;
  ceiling_delta: number | null;
  ceiling_method: string | null;
  ceiling_supported: boolean | null;
  round_count: number | null;
};

type PerfRow = {
  team_id: string;
  event_id: string;
  weekend_date: string | null;
  round: string | null;
  round_raw: string | null;
  round_phase: string | null;
  deductions: number | null;
};

type TeamStats = {
  avgScore: number | null;
  avgCeiling: number | null;
  hitZeroRate: number;
  hitZeroHits: number;
  hitZeroTotal: number;
  eventCount: number;
};

type TeamSeriesPoint = {
  event_id: string;
  event_name: string;
  weekend_date: string;
  event_score: number | null;
  ceiling_score: number | null;
};

const RED = "#ef4444";
const BLUE = "#3b82f6";
const CEILING_A = "#facc15";
const CEILING_B = "#a855f7";

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function avg(nums: Array<number | null | undefined>): number | null {
  const clean = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (!clean.length) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

function fmt3(n: number | null | undefined) {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(3) : "—";
}

function fmt1(n: number | null | undefined) {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(1) : "—";
}

function teamLabel(opt: TeamOption | null) {
  if (!opt) return "Select a team";
  const left = [opt.program, opt.team].filter(Boolean).join(" • ");
  return opt.division ? `${left} (${opt.division})` : left;
}

function sameDateLabel(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function computeHitRate(rows: PerfRow[]) {
  let hits = 0;
  let total = 0;

  for (const r of rows) {
    if (r.deductions === null || r.deductions === undefined) continue;

    const ded = Number(r.deductions);
    if (!Number.isFinite(ded)) continue;

    total += 1;
    if (Math.abs(ded) < 0.0001) hits += 1;
  }

  return {
    hits,
    total,
    pct: total ? (hits / total) * 100 : 0,
  };
}

function mergeSeries(
  aLabel: string,
  bLabel: string,
  aRows: TeamSeriesPoint[],
  bRows: TeamSeriesPoint[]
) {
  const map = new Map<string, Record<string, string | number | null>>();

  for (const r of aRows) {
    const key = r.weekend_date;

    const existing = map.get(key) ?? {
      weekend_date: r.weekend_date,
      date_label: sameDateLabel(r.weekend_date),
      [`${aLabel}_event_name`]: null,
      [`${bLabel}_event_name`]: null,
      [`${aLabel}_score`]: null,
      [`${aLabel}_ceiling`]: null,
      [`${bLabel}_score`]: null,
      [`${bLabel}_ceiling`]: null,
    };

    existing[`${aLabel}_event_name`] = r.event_name;
    existing[`${aLabel}_score`] = r.event_score;
    existing[`${aLabel}_ceiling`] = r.ceiling_score;

    map.set(key, existing);
  }

  for (const r of bRows) {
    const key = r.weekend_date;

    const existing = map.get(key) ?? {
      weekend_date: r.weekend_date,
      date_label: sameDateLabel(r.weekend_date),
      [`${aLabel}_event_name`]: null,
      [`${bLabel}_event_name`]: null,
      [`${aLabel}_score`]: null,
      [`${aLabel}_ceiling`]: null,
      [`${bLabel}_score`]: null,
      [`${bLabel}_ceiling`]: null,
    };

    existing[`${bLabel}_event_name`] = r.event_name;
    existing[`${bLabel}_score`] = r.event_score;
    existing[`${bLabel}_ceiling`] = r.ceiling_score;

    map.set(key, existing);
  }

  return Array.from(map.values()).sort((x, y) => {
    const dx = String(x.weekend_date ?? "");
    const dy = String(y.weekend_date ?? "");
    return dx.localeCompare(dy);
  });
}

export default function ComparePage() {
  return (
    <PremiumGate nextPath="/compare">
      <TeamComparisonInner />
    </PremiumGate>
  );
}

function TeamComparisonInner() {
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [optionsA, setOptionsA] = useState<TeamOption[]>([]);
  const [optionsB, setOptionsB] = useState<TeamOption[]>([]);
  const [teamA, setTeamA] = useState<TeamOption | null>(null);
  const [teamB, setTeamB] = useState<TeamOption | null>(null);
  const [eventsA, setEventsA] = useState<EventRow[]>([]);
  const [eventsB, setEventsB] = useState<EventRow[]>([]);
  const [ceilingsA, setCeilingsA] = useState<Map<string, CeilingRow>>(new Map());
  const [ceilingsB, setCeilingsB] = useState<Map<string, CeilingRow>>(new Map());
  const [perfA, setPerfA] = useState<PerfRow[]>([]);
  const [perfB, setPerfB] = useState<PerfRow[]>([]);
  const [showCeiling, setShowCeiling] = useState(true);
  const [showScore, setShowScore] = useState(true);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [searchingA, setSearchingA] = useState(false);
  const [searchingB, setSearchingB] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamAName = teamA ? [teamA.program, teamA.team].filter(Boolean).join(" • ") : "Team A";
  const teamBName = teamB ? [teamB.program, teamB.team].filter(Boolean).join(" • ") : "Team B";

  useEffect(() => {
    const q = searchA.trim();
    if (q.length < 2) {
      setOptionsA([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearchingA(true);

        const { data, error } = await supabase
          .from("v_team_event_scores")
          .select("team_id, program, team, division")
          .ilike("team", `%${q}%`)
          .limit(100);

        if (error) throw error;
        if (cancelled) return;

        const seen = new Set<string>();
        const unique = (data ?? []).filter((r: any) => {
          const key = String(r.team_id);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setOptionsA(unique as TeamOption[]);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to search Team A");
      } finally {
        if (!cancelled) setSearchingA(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchA]);

  useEffect(() => {
    const q = searchB.trim();
    if (q.length < 2) {
      setOptionsB([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearchingB(true);

        const { data, error } = await supabase
          .from("v_team_event_scores")
          .select("team_id, program, team, division")
          .ilike("team", `%${q}%`)
          .limit(100);

        if (error) throw error;
        if (cancelled) return;

        const seen = new Set<string>();
        const unique = (data ?? []).filter((r: any) => {
          const key = String(r.team_id);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setOptionsB(unique as TeamOption[]);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to search Team B");
      } finally {
        if (!cancelled) setSearchingB(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchB]);

  useEffect(() => {
    if (!teamA?.team_id) {
      setEventsA([]);
      setCeilingsA(new Map());
      setPerfA([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingA(true);
        setError(null);

        const { data: scoreData, error: scoreErr } = await supabase
          .from("v_team_event_scores")
          .select("team_id, program, team, event_id, event_name, weekend_date, division, event_score")
          .eq("team_id", teamA.team_id)
          .order("weekend_date", { ascending: true });

        if (scoreErr) throw scoreErr;
        if (cancelled) return;

        const scoreRows = (scoreData ?? []) as EventRow[];
        setEventsA(scoreRows);

        const eventIds = Array.from(new Set(scoreRows.map((r) => String(r.event_id)).filter(Boolean)));

        const [ceilingRes, perfRes] = await Promise.all([
          eventIds.length
            ? supabase
                .from("mv_team_event_ceiling_rebuilt")
                .select("team_id, event_id, ceiling_score, ceiling_delta, ceiling_method, ceiling_supported, round_count")
                .in("event_id", eventIds)
                .eq("team_id", teamA.team_id)
            : Promise.resolve({ data: [], error: null } as any),
          supabase
            .from("v_results_normalized")
            .select("team_id, event_id, weekend_date, round, round_raw, round_phase, deductions")
            .eq("team_id", teamA.team_id)
            .in("round_phase", ["Prelims", "Finals"])
            .order("weekend_date", { ascending: true }),
        ]);

        if (ceilingRes.error) throw ceilingRes.error;
        if (perfRes.error) throw perfRes.error;
        if (cancelled) return;

        const ceilingMap = new Map<string, CeilingRow>();
        for (const row of (ceilingRes.data ?? []) as CeilingRow[]) {
          ceilingMap.set(String(row.event_id), row);
        }

        setCeilingsA(ceilingMap);
        setPerfA((perfRes.data ?? []) as PerfRow[]);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to load Team A");
      } finally {
        if (!cancelled) setLoadingA(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [teamA]);

  useEffect(() => {
    if (!teamB?.team_id) {
      setEventsB([]);
      setCeilingsB(new Map());
      setPerfB([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingB(true);
        setError(null);

        const { data: scoreData, error: scoreErr } = await supabase
          .from("v_team_event_scores")
          .select("team_id, program, team, event_id, event_name, weekend_date, division, event_score")
          .eq("team_id", teamB.team_id)
          .order("weekend_date", { ascending: true });

        if (scoreErr) throw scoreErr;
        if (cancelled) return;

        const scoreRows = (scoreData ?? []) as EventRow[];
        setEventsB(scoreRows);

        const eventIds = Array.from(new Set(scoreRows.map((r) => String(r.event_id)).filter(Boolean)));

        const [ceilingRes, perfRes] = await Promise.all([
          eventIds.length
            ? supabase
                .from("mv_team_event_ceiling_rebuilt")
                .select("team_id, event_id, ceiling_score, ceiling_delta, ceiling_method, ceiling_supported, round_count")
                .in("event_id", eventIds)
                .eq("team_id", teamB.team_id)
            : Promise.resolve({ data: [], error: null } as any),
          supabase
            .from("v_results_normalized")
            .select("team_id, event_id, weekend_date, round, round_raw, round_phase, deductions")
            .eq("team_id", teamB.team_id)
            .in("round_phase", ["Prelims", "Finals"])
            .order("weekend_date", { ascending: true }),
        ]);

        if (ceilingRes.error) throw ceilingRes.error;
        if (perfRes.error) throw perfRes.error;
        if (cancelled) return;

        const ceilingMap = new Map<string, CeilingRow>();
        for (const row of (ceilingRes.data ?? []) as CeilingRow[]) {
          ceilingMap.set(String(row.event_id), row);
        }

        setCeilingsB(ceilingMap);
        setPerfB((perfRes.data ?? []) as PerfRow[]);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to load Team B");
      } finally {
        if (!cancelled) setLoadingB(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [teamB]);

  const seriesA = useMemo<TeamSeriesPoint[]>(() => {
    return eventsA.map((r) => ({
      event_id: String(r.event_id),
      event_name: r.event_name ?? String(r.event_id),
      weekend_date: r.weekend_date ?? "",
      event_score: toNum(r.event_score),
      ceiling_score: toNum(ceilingsA.get(String(r.event_id))?.ceiling_score),
    }));
  }, [eventsA, ceilingsA]);

  const seriesB = useMemo<TeamSeriesPoint[]>(() => {
    return eventsB.map((r) => ({
      event_id: String(r.event_id),
      event_name: r.event_name ?? String(r.event_id),
      weekend_date: r.weekend_date ?? "",
      event_score: toNum(r.event_score),
      ceiling_score: toNum(ceilingsB.get(String(r.event_id))?.ceiling_score),
    }));
  }, [eventsB, ceilingsB]);

  const statsA = useMemo<TeamStats>(() => {
    const hitRate = computeHitRate(perfA);
    return {
      avgScore: avg(eventsA.map((r) => toNum(r.event_score))),
      avgCeiling: avg(seriesA.map((r) => r.ceiling_score)),
      hitZeroRate: hitRate.pct,
      hitZeroHits: hitRate.hits,
      hitZeroTotal: hitRate.total,
      eventCount: eventsA.length,
    };
  }, [eventsA, perfA, seriesA]);

  const statsB = useMemo<TeamStats>(() => {
    const hitRate = computeHitRate(perfB);
    return {
      avgScore: avg(eventsB.map((r) => toNum(r.event_score))),
      avgCeiling: avg(seriesB.map((r) => r.ceiling_score)),
      hitZeroRate: hitRate.pct,
      hitZeroHits: hitRate.hits,
      hitZeroTotal: hitRate.total,
      eventCount: eventsB.length,
    };
  }, [eventsB, perfB, seriesB]);

  const chartData = useMemo(() => {
    if (!teamA || !teamB) return [];
    return mergeSeries("teamA", "teamB", seriesA, seriesB);
  }, [teamA, teamB, seriesA, seriesB]);

  const firstDate = chartData[0]?.weekend_date;
  const lastDate = chartData[chartData.length - 1]?.weekend_date;

  const seasonLabel =
    firstDate && lastDate
      ? `${new Date(firstDate).toLocaleString("default", { month: "short" })} → ${new Date(
          lastDate
        ).toLocaleString("default", { month: "short" })}`
      : "";

  const hitZeroBarData = useMemo(
    () => [
      {
        name: teamA ? [teamA.program, teamA.team].filter(Boolean).join(" • ") : "Team A",
        rate: Number(statsA.hitZeroRate.toFixed(1)),
        fill: RED,
      },
      {
        name: teamB ? [teamB.program, teamB.team].filter(Boolean).join(" • ") : "Team B",
        rate: Number(statsB.hitZeroRate.toFixed(1)),
        fill: BLUE,
      },
    ],
    [statsA.hitZeroRate, statsB.hitZeroRate, teamA, teamB]
  );

  const ready = !!teamA && !!teamB;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Elite Cheer Stats</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Team Comparison Tool
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400 md:text-base">
              Compare two teams head-to-head. Who&apos;s better?
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-700 hover:bg-slate-800"
          >
            Back to Home
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-red-900/40 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-300">Team A</div>
            <input
              value={searchA}
              onChange={(e) => setSearchA(e.target.value)}
              placeholder="Search program or team"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-red-500"
            />
            <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60">
              {searchingA ? (
                <div className="px-4 py-3 text-sm text-slate-400">Searching…</div>
              ) : optionsA.length ? (
                optionsA.map((opt) => (
                  <button
                    key={opt.team_id}
                    onClick={() => {
                      setTeamA(opt);
                      setSearchA([opt.program, opt.team].filter(Boolean).join(" • "));
                      setOptionsA([]);
                    }}
                    className="block w-full border-b border-slate-800 px-4 py-3 text-left text-sm transition hover:bg-slate-800/70 last:border-b-0"
                  >
                    <div className="font-semibold text-white">
                      {[opt.program, opt.team].filter(Boolean).join(" • ")}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{opt.division ?? "—"}</div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-slate-500">Type at least 2 characters to search.</div>
              )}
            </div>
            <div className="mt-3 rounded-xl bg-red-950/20 px-4 py-3 text-sm text-red-100">
              {teamLabel(teamA)}
            </div>
          </div>

          <div className="rounded-2xl border border-blue-900/40 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-300">Team B</div>
            <input
              value={searchB}
              onChange={(e) => setSearchB(e.target.value)}
              placeholder="Search program or team"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-blue-500"
            />
            <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60">
              {searchingB ? (
                <div className="px-4 py-3 text-sm text-slate-400">Searching…</div>
              ) : optionsB.length ? (
                optionsB.map((opt) => (
                  <button
                    key={opt.team_id}
                    onClick={() => {
                      setTeamB(opt);
                      setSearchB([opt.program, opt.team].filter(Boolean).join(" • "));
                      setOptionsB([]);
                    }}
                    className="block w-full border-b border-slate-800 px-4 py-3 text-left text-sm transition hover:bg-slate-800/70 last:border-b-0"
                  >
                    <div className="font-semibold text-white">
                      {[opt.program, opt.team].filter(Boolean).join(" • ")}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{opt.division ?? "—"}</div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-slate-500">Type at least 2 characters to search.</div>
              )}
            </div>
            <div className="mt-3 rounded-xl bg-blue-950/20 px-4 py-3 text-sm text-blue-100">
              {teamLabel(teamB)}
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <StatCard
            title="Average Score"
            leftColor={RED}
            rightColor={BLUE}
            leftLabel={teamA ? [teamA.program, teamA.team].filter(Boolean).join(" • ") : "Team A"}
            rightLabel={teamB ? [teamB.program, teamB.team].filter(Boolean).join(" • ") : "Team B"}
            leftValue={loadingA ? "—" : fmt3(statsA.avgScore)}
            rightValue={loadingB ? "—" : fmt3(statsB.avgScore)}
          />
          <StatCard
            title="Average Ceiling"
            leftColor={RED}
            rightColor={BLUE}
            leftLabel={teamA ? [teamA.program, teamA.team].filter(Boolean).join(" • ") : "Team A"}
            rightLabel={teamB ? [teamB.program, teamB.team].filter(Boolean).join(" • ") : "Team B"}
            leftValue={loadingA ? "—" : fmt3(statsA.avgCeiling)}
            rightValue={loadingB ? "—" : fmt3(statsB.avgCeiling)}
          />
          <StatCard
            title="Events Tracked"
            leftColor={RED}
            rightColor={BLUE}
            leftLabel={teamA ? [teamA.program, teamA.team].filter(Boolean).join(" • ") : "Team A"}
            rightLabel={teamB ? [teamB.program, teamB.team].filter(Boolean).join(" • ") : "Team B"}
            leftValue={loadingA ? "—" : String(statsA.eventCount)}
            rightValue={loadingB ? "—" : String(statsB.eventCount)}
          />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Season Trend</h2>
                <div className="mt-1 text-sm font-medium text-slate-300">{seasonLabel}</div>
                <p className="mt-1 text-sm text-slate-400">
                  Red vs Blue score trend, with optional ceiling overlays.
                </p>
              </div>

              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <label className="inline-flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={showScore}
                    onChange={(e) => setShowScore(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-teal-400 focus:ring-teal-500"
                  />
                  Show Score
                </label>

                <label className="inline-flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={showCeiling}
                    onChange={(e) => setShowCeiling(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-teal-400 focus:ring-teal-500"
                  />
                  Show Ceiling Score
                </label>
              </div>
            </div>

            <div className="h-[420px]">
              {ready ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date_label"
                      tickFormatter={(value: string) => {
                        if (!chartData?.length) return "";

                        if (value === chartData[0].date_label) return value;
                        if (value === chartData[chartData.length - 1].date_label) return value;

                        return "";
                      }}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[85, 100]}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={{ stroke: "#334155" }}
                    />
                    <Tooltip
                      content={
                        <ComparisonTooltip
                          teamAName={teamAName}
                          teamBName={teamBName}
                        />
                      }
                    />
                    <Legend />

                    {showScore ? (
                      <Line
                        type="monotone"
                        dataKey="teamA_score"
                        name={`${teamAName} Score`}
                        stroke={RED}
                        strokeWidth={4}
                        dot={{ r: 4 }}
                        connectNulls={true}
                      />
                    ) : null}

                    {showCeiling ? (
                      <Line
                        type="monotone"
                        dataKey="teamA_ceiling"
                        name={`${teamAName} Ceiling`}
                        stroke={CEILING_A}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                        connectNulls={true}
                      />
                    ) : null}

                    {showScore ? (
                      <Line
                        type="monotone"
                        dataKey="teamB_score"
                        name={`${teamBName} Score`}
                        stroke={BLUE}
                        strokeWidth={4}
                        dot={{ r: 4 }}
                        connectNulls={true}
                      />
                    ) : null}

                    {showCeiling ? (
                      <Line
                        type="monotone"
                        dataKey="teamB_ceiling"
                        name={`${teamBName} Ceiling`}
                        stroke={CEILING_B}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                        connectNulls={true}
                      />
                    ) : null}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-800 text-sm text-slate-500">
                  Select Team A and Team B to render the comparison chart.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white">Hit Zero Rate</h2>
              <p className="mt-1 text-sm text-slate-400">
                Performance-level zero-deduction rate, side-by-side.
              </p>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-4">
                <div className="text-xs uppercase tracking-wide text-red-300">{teamAName}</div>
                <div className="mt-2 text-3xl font-extrabold text-red-200">
                  {loadingA ? "—" : `${fmt1(statsA.hitZeroRate)}%`}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {loadingA ? "—" : `${statsA.hitZeroHits}/${statsA.hitZeroTotal} performances`}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 p-4">
                <div className="text-xs uppercase tracking-wide text-blue-300">{teamBName}</div>
                <div className="mt-2 text-3xl font-extrabold text-blue-200">
                  {loadingB ? "—" : `${fmt1(statsB.hitZeroRate)}%`}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {loadingB ? "—" : `${statsB.hitZeroHits}/${statsB.hitZeroTotal} performances`}
                </div>
              </div>
            </div>

            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hitZeroBarData} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 12 }} width={130} />
                  <Tooltip formatter={(value: any) => `${value}%`} />
                  <Bar dataKey="rate" radius={[0, 8, 8, 0]}>
                    {hitZeroBarData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  leftColor,
  rightColor,
}: {
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftValue: string;
  rightValue: string;
  leftColor: string;
  rightColor: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{title}</div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div
          className="flex h-[96px] flex-col justify-between rounded-xl p-3"
          style={{ backgroundColor: "rgba(15,23,42,0.7)", border: `1px solid ${leftColor}33` }}
        >
          <div className="text-xs text-slate-400">{leftLabel}</div>
          <div className="text-2xl font-extrabold" style={{ color: leftColor }}>
            {leftValue}
          </div>
        </div>

        <div
          className="flex h-[96px] flex-col justify-between rounded-xl p-3"
          style={{ backgroundColor: "rgba(15,23,42,0.7)", border: `1px solid ${rightColor}33` }}
        >
          <div className="text-xs text-slate-400">{rightLabel}</div>
          <div className="text-2xl font-extrabold" style={{ color: rightColor }}>
            {rightValue}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparisonTooltip({ active, payload, teamAName, teamBName }: any) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload ?? {};

  const byKey: Record<string, any> = {};
  payload.forEach((p: any) => {
    byKey[p.dataKey] = p;
  });

  const renderItem = (item: any) => {
    if (!item) return null;

    return (
      <div className="mb-1 flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span className="text-slate-300">{item.name}:</span>
        <span className="font-semibold text-white">{fmt3(Number(item.value))}</span>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-2xl">
      {row.teamA_event_name && (
        <div className="mb-1 font-semibold text-red-300">
          {teamAName} Event: {row.teamA_event_name}
        </div>
      )}

      {row.teamB_event_name && (
        <div className="mb-2 font-semibold text-blue-300">
          {teamBName} Event: {row.teamB_event_name}
        </div>
      )}

      <div className="mb-3 text-[11px] text-slate-400">{row.date_label}</div>

      {renderItem(byKey["teamA_score"])}
      {renderItem(byKey["teamA_ceiling"])}

      <div className="h-2" />

      {renderItem(byKey["teamB_score"])}
      {renderItem(byKey["teamB_ceiling"])}
    </div>
  );
}