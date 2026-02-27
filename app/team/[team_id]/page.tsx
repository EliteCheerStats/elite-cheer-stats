"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
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

export default function TeamProfilePage() {
  const params = useParams<{ team_id: string }>();
  const teamId = params.team_id;

  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);



  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("v_results_normalized")
        .select("*")
        .eq("team_id", teamId)
        .order("weekend_date", { ascending: false })
        .limit(20000);

      if (cancelled) return;

      if (error) setError(error);
      else setRows(data ?? []);

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const filtered = useMemo(() => rows, [rows]);

const trendData = useMemo(() => {
  const map = new Map<
    string,
    { score: number; event: string }
  >();

  for (const r of filtered) {
    const wd = String(r.weekend_date ?? "");
    const score = toNum(r.event_score);
    const event = String(r.event_name ?? "");

    if (!wd || score === null) continue;

    const existing = map.get(wd);

    if (!existing || score > existing.score) {
      map.set(wd, {
        score,
        event,
      });
    }
  }

  return Array.from(map.entries())
    .map(([weekend, value]) => ({
      weekend,
      event_score: value.score,
      event: value.event,
    }))
    .sort((a, b) => a.weekend.localeCompare(b.weekend));
}, [filtered]);

  const header = useMemo(() => {
    const first = rows[0];
    if (!first) return { title: `Team ${teamId}`, subtitle: "" };

    const team = String(first.team ?? "—");
    const program = String(first.program ?? "—");
    return {
      title: `${team} — ${program}`,
      subtitle: `team_id: ${teamId}`,
    };
  }, [rows, teamId]);

  const stats = useMemo(() => {
    const scores = filtered
      .map((r) => toNum(r.event_score))
      .filter((v): v is number => v !== null);

    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const best = scores.length ? Math.max(...scores) : null;

    const events = new Set(filtered.map((r) => String(r.event_name ?? r.event_id ?? ""))).size;
    const weekends = new Set(filtered.map((r) => String(r.weekend_date ?? ""))).size;

    return { rows: filtered.length, events, weekends, avg, best };
  }, [filtered]);

  return (
  <main className="space-y-6">
    {/* Top nav / back */}
    <div className="flex items-center justify-between gap-4">
      <Link
        href="/team"
        className="text-sm font-semibold text-slate-200 hover:text-white"
      >
        ← Team Search
      </Link>

      <div className="text-xs text-slate-400">
        {header.subtitle}
      </div>
    </div>

    {/* Title + headline stats */}
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            {header.title}
          </h1>
          <p className="mt-2 text-slate-300">
            Filter results by weekend and level. Your core numbers update instantly.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            Rows: <span className="font-semibold">{loading ? "…" : stats.rows}</span>
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            Events: <span className="font-semibold">{loading ? "…" : stats.events}</span>
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            Weekends: <span className="font-semibold">{loading ? "…" : stats.weekends}</span>
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Average</div>
          <div className="mt-2 text-2xl font-extrabold text-teal-300">
            {loading ? "—" : (stats.avg?.toFixed(3) ?? "—")}
          </div>
          <div className="mt-1 text-xs text-slate-400">Event score</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Best</div>
          <div className="mt-2 text-2xl font-extrabold text-teal-300">
            {loading ? "—" : (stats.best?.toFixed(3) ?? "—")}
          </div>
          <div className="mt-1 text-xs text-slate-400">Peak event score</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Events</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-100">
            {loading ? "—" : stats.events}
          </div>
          <div className="mt-1 text-xs text-slate-400">Unique events</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Weekends</div>
          <div className="mt-2 text-2xl font-extrabold text-slate-100">
            {loading ? "—" : stats.weekends}
          </div>
          <div className="mt-1 text-xs text-slate-400">Unique weekends</div>
        </div>
      </div>
    </div>

    {/* Filters */}
   

    {/* Error / empty states */}
    {error && (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
        <div className="font-semibold text-red-200">Error</div>
        <pre className="mt-2 overflow-x-auto text-xs text-red-100">
          {JSON.stringify(error, null, 2)}
        </pre>
      </div>
    )}

    {!loading && !error && filtered.length === 0 && (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-200">
        No rows for this team with current filters.
      </div>
    )}

    {/* Results Table */}
    {!loading && !error && filtered.length > 0 && (
      <div className="rounded-2xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Results</div>
            <div className="text-xs text-slate-400">
              Showing {filtered.length.toLocaleString()} rows
            </div>
          </div>
        </div>

<div className="rounded-2xl border border-white/10 bg-white/5 p-5">
  <div className="flex items-end justify-between gap-4">
    <div>
      <h2 className="text-lg font-bold text-slate-100">Score Trend</h2>
      <p className="text-sm text-slate-400">Best event score per weekend (based on current filters).</p>
    </div>
    <div className="text-xs text-slate-400">
      Points: <span className="font-semibold text-slate-200">{trendData.length}</span>
    </div>
  </div>

  <div className="mt-4 h-64">
    {trendData.length < 2 ? (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Not enough data points yet for a trend line.
      </div>
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="weekend"
            tick={{ fill: "rgba(226,232,240,0.7)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
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
              if (!payload || !payload.length) return label
              return payload[0].payload.event
            }}
          />
          <Line
            type="monotone"
            dataKey="event_score"
            stroke="rgba(45,212,191,0.95)"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    )}
  </div>
</div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-slate-200">
              <tr className="text-left">
                <th className="px-3 py-3">Weekend</th>
                <th className="px-3 py-3">Event</th>
                <th className="px-3 py-3">Division</th>
                <th className="px-3 py-3">Size</th>
                <th className="px-3 py-3 text-right">Raw</th>
                <th className="px-3 py-3 text-right">Ded</th>
                <th className="px-3 py-3 text-right">Perf</th>
                <th className="px-3 py-3 text-right">Event</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {filtered.map((r, idx) => (
                <tr key={`${idx}`} className="text-slate-100 hover:bg-white/5">
                  <td className="px-3 py-3 text-slate-300">
                    {String(r.weekend_date ?? "—")}
                  </td>

                  <td className="px-3 py-3 font-semibold">
                    {String(pick(r, ["event_name", "event_id"], "—"))}
                  </td>

                  <td className="px-3 py-3 text-slate-200">
                    {String(r.division ?? "—")}
                  </td>

                  <td className="px-3 py-3 font-semibold">
                    {String(r.size_effective ?? "—")}
                  </td>

                  <td className="px-3 py-3 text-right">
                     {r.raw_score?.toFixed(2)}
                  </td>

                  <td className="px-3 py-3 text-right">
                    {r.deductions}
                  </td>

                  <td className="px-3 py-3 text-right">
                    {r.performance_score?.toFixed(3)}
                  </td>

                  <td className="px-3 py-3 text-right font-semibold">
                    {r.event_score?.toFixed(3)}
                  </td>
                 
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </main>
);
}
