"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = Record<string, any>;

function pick(row: Row, keys: string[], fallback = "—") {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
  }
  return fallback;
}

function toNum(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtScore(v: any, digits = 3) {
  const n = toNum(v);
  return n === null ? "—" : n.toFixed(digits);
}

function getEventSizeStars(teamCount: number | null | undefined): string {
  if (!teamCount || teamCount <= 0) return "—";
  if (teamCount < 100) return "⭐";
  if (teamCount < 250) return "⭐⭐";
  if (teamCount < 500) return "⭐⭐⭐";
  return "⭐⭐⭐⭐";
}

function computeHitRate(rows: Row[]) {
  let hits = 0;
  let total = 0;

  for (const r of rows) {
    const ded = Number(r.deductions ?? 0);
    if (Number.isFinite(ded)) {
      total += 1;
      if (ded === 0) hits += 1;
    }
  }

  return {
    hits,
    total,
    pct: total ? (hits / total) * 100 : 0,
  };
}

export default function TeamProfilePage() {
  const params = useParams<{ team_id: string }>();
  const teamId = params.team_id;

  const [rows, setRows] = useState<Row[]>([]);
  const [championshipRows, setChampionshipRows] = useState<Row[]>([]);
  const [performanceRows, setPerformanceRows] = useState<Row[]>([]);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCeiling, setShowCeiling] = useState(false);

  const [premiumLoading, setPremiumLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;

    async function checkPremium() {
      setPremiumLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;
      setSession(session);

      if (!session?.user) {
        setIsPremium(false);
        setPremiumLoading(false);
        return;
      }

      const { data: followed } = await supabase
        .from("user_followed_teams")
        .select("team_id")
        .eq("user_id", session.user.id);

      if (followed) setFollowedIds(new Set(followed.map((d: any) => d.team_id)));

      const { data, error } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("team profile premium check error:", error);
        setIsPremium(false);
        setPremiumLoading(false);
        return;
      }

      setIsPremium(!!data?.is_premium);
      setPremiumLoading(false);
    }

    checkPremium();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      checkPremium();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isPremium && showCeiling) setShowCeiling(false);
  }, [isPremium, showCeiling]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const currentTeamId = params.team_id;

        const { data: eventData, error: eventError } = await supabase
          .from("v_team_event_scores_uuid")
          .select(`
            team_id,
            program_id,
            program,
            team,
            event_id,
            event_name,
            weekend_date,
            division,
            size_effective,
            event_score
          `)
          .eq("team_id", currentTeamId)
          .order("weekend_date", { ascending: true });

        if (eventError) {
          if (!cancelled) {
            setError({
              message: eventError?.message,
              details: eventError?.details,
              hint: eventError?.hint,
              code: eventError?.code,
            });
            setRows([]);
            setChampionshipRows([]);
            setPerformanceRows([]);
            setLoading(false);
          }
          return;
        }

        const eventRows = eventData ?? [];
        const eventIds = Array.from(new Set(eventRows.map((r: any) => String(r.event_id ?? "")).filter(Boolean)));

        let eventCountData: any[] = [];
        if (eventIds.length > 0) {
          const { data: eventCountsRes, error: eventCountsError } = await supabase
            .from("v_event_team_counts")
            .select("event_id, team_count")
            .in("event_id", eventIds);

          if (eventCountsError) console.error("Event counts query failed:", eventCountsError);
          else eventCountData = eventCountsRes ?? [];
        }

        let ceilingData: any[] = [];
        let perfData: any[] = [];

        if (eventIds.length > 0 && eventRows.length > 0) {
          const selectedTeam = String(eventRows[0]?.team ?? "").trim().toLowerCase();

          const { data: perfRes, error: perfError } = await supabase
            .from("v_results_normalized")
            .select(`
              team,
              program,
              program_id,
              team_id,
              event_id,
              weekend_date,
              round,
              round_raw,
              round_phase,
              raw_score,
              deductions,
              performance_score,
              event_score
            `)
            .eq("team_id", currentTeamId)
            .in("round_phase", ["Prelims", "Finals"])
            .order("weekend_date", { ascending: true });

          if (perfError) console.error("Performance query failed:", perfError);
          else perfData = (perfRes ?? []).filter((r: any) => String(r.team ?? "").trim().toLowerCase() === selectedTeam);

          const { data: ceilingRes, error: ceilingError } = await supabase
            .from("mv_team_event_ceiling_rebuilt")
            .select(`
              team_id,
              event_id,
              ceiling_score,
              ceiling_delta,
              ceiling_method,
              ceiling_supported,
              round_count
            `)
            .in("event_id", eventIds)
            .eq("team_id", currentTeamId);

          if (ceilingError) console.error("Ceiling query failed:", ceilingError);
          else ceilingData = ceilingRes ?? [];
        }

        const ceilings = new Map(ceilingData.map((c: any) => [String(c.event_id), c]));
        const eventCounts = new Map(eventCountData.map((r: any) => [String(r.event_id), r.team_count]));

        const mergedRows = eventRows.map((r: any) => {
          const c = ceilings.get(String(r.event_id));
          const teamCount = eventCounts.get(String(r.event_id)) ?? null;

          return {
            ...r,
            is_championship: false,
            team_count: teamCount,
            ceiling_score_true: c?.ceiling_score ?? null,
            ceiling_delta: c?.ceiling_delta ?? null,
            ceiling_method: c?.ceiling_method ?? null,
            ceiling_supported: c?.ceiling_supported ?? false,
            round_count: c?.round_count ?? null,
          };
        });

        const { data: champRaw, error: champError } = await supabase
          .from("v_team_event_scores_championship")
          .select(`
            team_id,
            program_id,
            program,
            team,
            event_id,
            event_name,
            weekend_date,
            division,
            rank,
            event_score,
            raw_score,
            performance_score,
            deductions,
            round
          `)
          .eq("team_id", currentTeamId);

        if (champError) {
          console.error("Championship query failed:", {
            message: champError?.message,
            details: champError?.details,
            hint: champError?.hint,
            code: champError?.code,
          });
        }

        const champSourceRows = champError ? [] : champRaw ?? [];
        const champByEvent = new Map<string, Row>();

        for (const r of champSourceRows) {
          const eventId = String(r.event_id ?? "");
          if (!eventId) continue;

          const score = toNum(r.event_score);
          const existing = champByEvent.get(eventId);
          const existingScore = existing ? toNum(existing.event_score) : null;

          if (!existing || (score !== null && (existingScore === null || score >= existingScore))) {
            champByEvent.set(eventId, {
              ...r,
              is_championship: true,
              team_count: null,
              ceiling_score_true: score,
              ceiling_supported: true,
              championship_label: r.event_name ?? "Championship",
            });
          }
        }

        const mergedChampionshipRows = Array.from(champByEvent.values()).sort((a, b) =>
          String(a.weekend_date ?? "").localeCompare(String(b.weekend_date ?? ""))
        );

        if (!cancelled) {
          setRows(mergedRows);
          setChampionshipRows(mergedChampionshipRows);
          setPerformanceRows(perfData);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError({ message: err instanceof Error ? err.message : String(err) });
          setRows([]);
          setChampionshipRows([]);
          setPerformanceRows([]);
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [params.team_id]);

  const filtered = useMemo(() => rows, [rows]);
  const hitRate = useMemo(() => computeHitRate(performanceRows), [performanceRows]);

  const championshipTop = useMemo(() => {
    if (championshipRows.length === 0) return null;

    return [...championshipRows].sort((a, b) => {
      const as = toNum(a.event_score) ?? -Infinity;
      const bs = toNum(b.event_score) ?? -Infinity;
      return bs - as;
    })[0];
  }, [championshipRows]);

  const tableRows = useMemo(() => {
    return [...filtered, ...championshipRows].sort((a, b) =>
      String(a.weekend_date ?? "").localeCompare(String(b.weekend_date ?? ""))
    );
  }, [filtered, championshipRows]);

  const trendData = useMemo(() => {
    const map = new Map<string, { score: number; ceiling: number | null; event: string; isChampionship: boolean }>();

    for (const r of tableRows) {
      const wd = String(r.weekend_date ?? "");
      const score = toNum(r.event_score);
      const ceiling = r.is_championship
        ? toNum(r.ceiling_score_true ?? r.event_score)
        : !premiumLoading && isPremium && r.ceiling_supported
          ? toNum(r.ceiling_score_true)
          : null;

      const event = String(r.event_name ?? "");
      const isChampionship = !!r.is_championship;

      if (!wd || score === null) continue;

      const existing = map.get(wd);
      if (!existing || score > existing.score || isChampionship) {
        map.set(wd, { score, ceiling, event, isChampionship });
      }
    }

    return Array.from(map.entries())
      .map(([weekend, value]) => {
        const isChampionship = value.isChampionship;

        return {
          weekend,
          event_score: value.score,
          regular_score: isChampionship ? null : value.score,
          summit_score: isChampionship ? value.score : null,
          summit_connector: isChampionship ? value.score : null,
          ceiling_score: value.ceiling,
          event: value.event,
          is_championship: isChampionship,
        };
      })
      .sort((a, b) => a.weekend.localeCompare(b.weekend));
  }, [tableRows, isPremium, premiumLoading]);

  const chartData = useMemo(() => {
    const data = [...trendData];
    const summitIndex = data.findIndex((d) => d.is_championship);

    if (summitIndex > 0) {
      data[summitIndex - 1] = {
        ...data[summitIndex - 1],
        summit_connector: data[summitIndex - 1].event_score,
      };
    }

    return data;
  }, [trendData]);

  const header = useMemo(() => {
    const first = rows[0] ?? championshipRows[0];
    if (!first) return { title: `Team ${teamId}`, subtitle: "" };

    return {
      title: `${String(first.team ?? "—")} — ${String(first.program ?? "—")}`,
      subtitle: `team_id: ${teamId}`,
    };
  }, [rows, championshipRows, teamId]);

  const stats = useMemo(() => {
    const scores = filtered.map((r) => toNum(r.event_score)).filter((v): v is number => v !== null);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const best = scores.length ? Math.max(...scores) : null;
    const events = new Set(filtered.map((r) => String(r.event_name ?? r.event_id ?? ""))).size;

    return { rows: filtered.length, events, avg, best };
  }, [filtered]);

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/team" className="text-sm font-semibold text-slate-200 hover:text-white">
          ← Team Search
        </Link>

        <div className="text-xs text-slate-400">{header.subtitle}</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-6">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          {header.title}
        </h1>

        <p className="mt-2 text-slate-300">
          {stats.avg !== null
            ? `This team is scoring ${stats.avg.toFixed(1)} — top teams are pushing 96+ 👀`
            : "Filter results by weekend and level. Your core numbers update instantly."}
        </p>

        {championshipTop && (
          <div
            className="mt-6 inline-block rounded-2xl px-6 py-4 text-left"
            style={{
              background: "linear-gradient(145deg, #062037, #020b14)",
              border: "2px solid #fde047",
              boxShadow: `
                0 0 0 1px rgba(253,224,71,0.35),
                0 0 18px rgba(253,224,71,0.25),
                0 0 32px rgba(253,224,71,0.15)
              `,
            }}
          >
            <div className="flex items-center justify-center gap-2 text-[13px] font-extrabold uppercase tracking-widest text-yellow-300">
              <span>🏆</span>
              <span>{String(championshipTop.event_name ?? "Championship")}</span>
              <span>🏆</span>
            </div>

            <div className="mt-4 flex items-stretch gap-4">
              <div className="flex flex-col justify-between">
                <div className="text-[11px] font-extrabold uppercase tracking-widest text-yellow-300/80 pb-1 border-b border-yellow-300/20">
                  Placement
                </div>
                <div className="text-3xl font-extrabold text-white">
                  #{championshipTop.rank ?? "—"}
                </div>
              </div>

              <div className="h-12 w-px bg-yellow-300/35" />

              <div className="flex flex-col justify-between">
                <div className="text-[11px] font-extrabold uppercase tracking-widest text-yellow-300/80 pb-1 border-b border-yellow-300/20">
                  Round
                </div>
                <div className="text-base font-extrabold uppercase leading-tight text-white text-center tracking-wide">
                  {(championshipTop.round ?? "—")
                    .split(" ")
                    .map((word: string, i: number) => (
                      <div key={i}>{word}</div>
                    ))}
                </div>
              </div>

              <div className="h-12 w-px bg-yellow-300/35" />

              <div className="flex flex-col justify-between">
                <div className="text-[11px] font-extrabold uppercase tracking-widest text-yellow-300/80 pb-1 border-b border-yellow-300/20">
                  Score
                </div>
                <div className="text-2xl font-extrabold text-yellow-300">
                  {fmtScore(championshipTop.event_score, 1)}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={async () => {
              if (!session?.user) {
                window.location.href = `/login?next=/team/${teamId}`;
                return;
              }

              const isFollowing = followedIds.has(teamId);

              if (isFollowing) {
                const { error } = await supabase
                  .from("user_followed_teams")
                  .delete()
                  .eq("user_id", session.user.id)
                  .eq("team_id", teamId);

                if (!error) {
                  setFollowedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(teamId);
                    return next;
                  });
                }
              } else {
                const { error } = await supabase.from("user_followed_teams").insert({
                  user_id: session.user.id,
                  team_id: teamId,
                });

                if (!error) {
                  setFollowedIds((prev) => new Set(prev).add(teamId));
                }
              }
            }}
            className={`px-4 py-2 rounded-lg font-semibold border transition ${
              followedIds.has(teamId)
                ? "border-teal-400 bg-teal-500/10 text-teal-300"
                : "border-white/15 bg-white/5 text-white hover:bg-white/10"
            }`}
          >
            {followedIds.has(teamId) ? "Following" : "Follow Team"}
          </button>

          <Link
            href="/compare"
            className="bg-teal-500/10 border border-teal-400 text-teal-300 hover:bg-teal-500/20 px-4 py-2 rounded-lg font-semibold transition"
          >
            Compare This Team →
          </Link>

          <Link
            href="/comp-builder"
            className="border border-teal-400 text-teal-300 hover:bg-teal-500/10 px-4 py-2 rounded-lg font-semibold transition"
          >
            Build Lineup
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            Rows: <span className="font-semibold">{loading ? "…" : stats.rows}</span>
          </span>

          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            Season Events: <span className="font-semibold">{loading ? "…" : stats.events}</span>
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Average</div>
            <div className="mt-2 text-2xl font-extrabold text-teal-300">
              {loading ? "—" : stats.avg?.toFixed(3) ?? "—"}
            </div>
            <div className="mt-1 text-xs text-slate-400">Season event score</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Top Event Score</div>
            <div className="mt-2 text-2xl font-extrabold text-teal-300">
              {loading ? "—" : stats.best?.toFixed(3) ?? "—"}
            </div>
            <div className="mt-1 text-xs text-slate-400">You're not seeing their true ceiling 👀</div>
          </div>

          {!premiumLoading && isPremium ? (
            <div className="rounded-2xl border border-teal-400/10 bg-teal-500/[0.03] p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">Hit Zero Rate</div>
              <div className="mt-2 text-2xl font-extrabold text-teal-300">
                {loading ? "—" : `${hitRate.pct.toFixed(1)}%`}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {loading ? "—" : `${hitRate.hits}/${hitRate.total} performances hit zero`}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-teal-400/10 bg-teal-500/[0.03] p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">Hit Zero Rate 🔒</div>

              <div className="mt-2 relative select-none">
                <div className="mt-2 text-2xl font-extrabold text-teal-300">•••</div>
                <div className="mt-2 text-xs text-slate-300 italic text-center">
                  This is often the difference between winning and placing
                </div>
                <div className="absolute inset-0 rounded-md bg-[#0b1220]/35 pointer-events-none" />
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0b1220]/80 px-3 py-2">
                <div className="text-xs text-slate-300">Unlock full team insights</div>
                <Link
                  href={session?.user ? "/upgrade" : "/login"}
                  className="rounded-md bg-teal-400 px-3 py-1.5 text-xs font-semibold text-black shadow-md hover:bg-teal-300 transition"
                >
                  See Full Breakdown
                </Link>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Season Events</div>
            <div className="mt-2 text-2xl font-extrabold text-slate-100">
              {loading ? "—" : stats.events}
            </div>
            <div className="mt-1 text-xs text-slate-400">Championship tracked separately</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="font-semibold text-red-200">Error</div>
          <pre className="mt-2 overflow-x-auto text-xs text-red-100">{JSON.stringify(error, null, 2)}</pre>
        </div>
      )}

      {!loading && !error && tableRows.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-200">
          No rows for this team with current filters.
        </div>
      )}

      {!loading && !error && tableRows.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">Results</div>
              <div className="text-xs text-slate-400">Showing {tableRows.length.toLocaleString()} rows</div>
              <div className="mt-1 text-sm font-semibold text-slate-200">
                {tableRows[0]?.team} — {tableRows[0]?.program}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-teal-500/10 border border-teal-400/20 px-3 py-1 text-xs font-semibold text-teal-300">
                  ⚡ One hit can change everything
                </div>
                <h2 className="text-lg font-bold text-white">Score Trend</h2>
                <p className="text-sm text-slate-400 mt-1">Event score by weekend</p>
              </div>

              <div className="text-xs text-slate-400">
                Points: <span className="font-semibold text-slate-200">{chartData.length}</span>
              </div>
            </div>

            <div className="mt-4 mb-2 flex items-center gap-2">
              <label
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  !premiumLoading && isPremium
                    ? "border-teal-400/30 bg-teal-500/10 text-teal-200"
                    : "cursor-not-allowed border-teal-400/15 bg-teal-500/[0.06] text-white/60"
                }`}
                title={!premiumLoading && isPremium ? "See how high they can actually score" : "Unlock winning potential"}
              >
                <input
                  id="toggle-ceiling"
                  type="checkbox"
                  checked={!premiumLoading && isPremium ? showCeiling : false}
                  onChange={(e) => {
                    if (!isPremium) return;
                    setShowCeiling(e.target.checked);
                  }}
                  disabled={premiumLoading || !isPremium}
                  className={`h-4 w-4 ${
                    !premiumLoading && isPremium ? "accent-teal-400 cursor-pointer" : "opacity-50 cursor-not-allowed"
                  }`}
                />
                <span className="font-semibold">Winning Potential</span>

                {!premiumLoading && !isPremium && (
                  <span className="ml-2 rounded-full border border-teal-400/20 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300">
                    Premium
                  </span>
                )}
              </label>
            </div>

            <div className="relative mt-4 h-64">
              {chartData.length < 2 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Not enough data points yet for a trend line.
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 28, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="weekend"
                        tick={{ fill: "rgba(226,232,240,0.7)", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                        tickFormatter={(value) => {
                          const point = chartData.find((d) => d.weekend === value);
                          return point?.is_championship ? "Youth Summit" : value;
                        }}
                      />
                      <YAxis
                        domain={["dataMin - 0.5", "dataMax + 0.5"]}
                        tick={{ fill: "rgba(226,232,240,0.7)", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(2,6,23,0.95)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 12,
                          color: "white",
                        }}
                        labelStyle={{ color: "rgba(226,232,240,0.8)" }}
                        labelFormatter={(label, payload) => {
                          if (!payload || !payload.length) return label;
                          const point = payload[0].payload;
                          return point.is_championship ? `🏆 ${point.event}` : point.event;
                        }}
                        formatter={(value, name) => {
  if (name === "summit_connector") return null;
  return [Number(value).toFixed(3), name];
}}
                      />
                      <Line
                        name="Season Score"
                        type="monotone"
                        dataKey="regular_score"
                        stroke="rgba(45,212,191,0.95)"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                      />
                      <Line
  type="linear"
  dataKey="summit_connector"
  stroke="#fde047"
  strokeWidth={3}
  strokeDasharray="8 6"
  dot={false}
  activeDot={false}
  connectNulls={false}
  legendType="none"
  hide={false}
/>
                      <Line
                        name="Summit Score"
                        type="linear"
                        dataKey="summit_score"
                        stroke="#fde047"
                        strokeWidth={0}
                        dot={{ r: 8, fill: "#fde047", stroke: "#062037", strokeWidth: 2 }}
                        activeDot={{ r: 10, fill: "#fde047", stroke: "#062037", strokeWidth: 2 }}
                        connectNulls={false}
                      />
                      {!premiumLoading &&
                        isPremium &&
                        showCeiling &&
                        chartData.some((d) => d.ceiling_score != null) && (
                          <Line
                            name="Ceiling Score"
                            type="monotone"
                            dataKey="ceiling_score"
                            stroke="#A855F7"
                            strokeDasharray="6 6"
                            strokeWidth={2}
                            dot={false}
                          />
                        )}
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead className="bg-white/5 text-slate-200">
                <tr className="text-left">
                  <th className="px-3 py-3">Weekend</th>
                  <th className="px-3 py-3">Event</th>
                  <th className="px-3 py-3">Division</th>
                  <th className="px-3 py-3">
                    <span title="Based on ECS-supported teams">ECS Event Size</span>
                  </th>
                  <th className="px-3 py-3 text-right">Score</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {!premiumLoading && isPremium ? "Ceiling" : "Ceiling 🔒"}
                  </th>
                </tr>
              </thead>

              <tbody>
                {tableRows.map((r, idx) => {
                  const isChampionship = !!r.is_championship;

                  return (
                    <tr
  key={`${r.event_id}-${idx}`}
  className={isChampionship ? "" : "text-slate-100 hover:bg-white/5"}
  style={
    isChampionship
      ? {
          background: "#062037",
          color: "#fde047",
          outline: "2px solid #fde047",
          outlineOffset: "-2px",
        }
      : undefined
  }
>
                      <td
                        className={`px-3 py-3 ${
                          isChampionship
                            ? "border-l-2 border-y-2 border-yellow-300 font-extrabold text-yellow-300"
                            : "border-t border-white/10 text-slate-300"
                        }`}
                      >
                        {String(r.weekend_date ?? "—")}
                      </td>

                      <td
                        className={`px-3 py-3 font-semibold ${
                          isChampionship ? "border-y-2 border-yellow-300 text-yellow-300" : "border-t border-white/10"
                        }`}
                      >
                        {String(pick(r, ["event_name", "event_id"], "—"))}
                      </td>

                      <td
                        className={`px-3 py-3 ${
                          isChampionship
                            ? "border-y-2 border-yellow-300 text-yellow-300"
                            : "border-t border-white/10 text-slate-200"
                        }`}
                      >
                        {String(r.division ?? "—")}
                      </td>

                      <td className={`px-3 py-3 font-semibold ${isChampionship ? "border-y-2 border-yellow-300" : "border-t border-white/10"}`}>
                        {isChampionship ? (
  <span className="font-extrabold text-yellow-300">🏆 Summit</span>
) : r.team_count ? (
                          <>
                            <span className="text-white">{getEventSizeStars(r.team_count)}</span>
                            <span className="ml-1 text-slate-400">({r.team_count})</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className={`px-3 py-2 text-right font-semibold ${isChampionship ? "border-y-2 border-yellow-300" : "border-t border-white/10"}`}>
                        <span
  className={
    isChampionship
      ? "inline-flex items-center justify-center rounded-md border border-yellow-300 bg-black/40 px-2 py-1 font-extrabold text-yellow-300"
      : ""
  }
>
  {fmtScore(r.event_score)}
</span>
                      </td>

                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          isChampionship ? "border-r-2 border-y-2 border-yellow-300" : "border-t border-white/10"
                        }`}
                      >
                        {isChampionship ? (
                          <span className="inline-flex items-center justify-center rounded-md border border-yellow-300 bg-black/40 px-2 py-1 font-extrabold text-yellow-300">{fmtScore(r.event_score)}</span>
                        ) : !premiumLoading && isPremium ? (
                          r.ceiling_supported ? fmtScore(r.ceiling_score_true) : "—"
                        ) : (
                          <span className="text-white/25 tracking-[0.2em]">•••••</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
