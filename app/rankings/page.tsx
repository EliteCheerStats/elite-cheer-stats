"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BarRankingsChart } from "./BarRankingsChart";

type Row = Record<string, any>;

function pick<T = any>(row: Row, candidates: string[], fallback: T): T {
  for (const key of candidates) {
    const v = row[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v as T;
  }
  return fallback;
}

function toNum(v: any): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalize(s: string) {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function titleCase(s: string) {
  const t = normalize(s);
  if (!t) return "";
  return t.replace(/\b\w/g, (m) => m.toUpperCase());
}

type SizeOpt = "Any" | "X-Small" | "Small" | "Medium" | "Large" | "X-Large";
type D2Mode = "Any" | "D2Only" | "NonD2Only";
type FlexMode = "Any" | "FlexOnly" | "NonFlexOnly";
type LevelOpt = "All" | "L1" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7";
type AgeOpt = "All" | "Tiny" | "Mini" | "Youth" | "Junior" | "Senior" | "U16" | "U18" | "Open";

type Filters = {
  search: string;
  level: LevelOpt;
  age: AgeOpt;
  d2Mode: D2Mode;
  flexMode: FlexMode;
  size: SizeOpt;
  requireTwoPlus: boolean; // default ON
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  level: "All",
  age: "All",
  d2Mode: "Any",
  flexMode: "Any",
  size: "Any",
  requireTwoPlus: true,
};

const SEASON_START = "2025-12-01";

// ---------- Parsing helpers ----------
function inferLevelFromDivision(divisionRaw: string): string | null {
  const d = String(divisionRaw ?? "");
  const m = d.match(/^\s*L\s*([1-7])\b/i) || d.match(/^\s*L([1-7])\b/i);
  return m ? `L${m[1]}` : null;
}

function inferAgeFromDivision(divisionRaw: string): string | null {
  const d = normalize(divisionRaw);
  const candidates: Array<[string, string]> = [
    ["tiny", "Tiny"],
    ["mini", "Mini"],
    ["youth", "Youth"],
    ["junior", "Junior"],
    ["senior", "Senior"],
    ["u16", "U16"],
    ["u18", "U18"],
    ["open", "Open"],
  ];
  for (const [k, label] of candidates) {
    if (d.includes(k)) return label;
  }
  return null;
}

function cleanSizeAny(v: any): Exclude<SizeOpt, "Any"> | null {
  const s0 = normalize(v);
  if (!s0) return null;

  const s = s0.replace(/-/g, " ").replace(/\s+/g, " ").trim();
  if (s === "x small" || s === "xsmall") return "X-Small";
  if (s === "small") return "Small";
  if (s === "medium") return "Medium";
  if (s === "large") return "Large";
  if (s === "x large" || s === "xlarge") return "X-Large";
  return null;
}

function inferSizeFromDivision(divisionRaw: string): Exclude<SizeOpt, "Any"> | null {
  const d = normalize(divisionRaw);
  if (d.includes("x-small") || d.includes("x small") || d.includes("xsmall")) return "X-Small";
  if (d.includes("x-large") || d.includes("x large") || d.includes("xlarge")) return "X-Large";
  if (d.includes(" small")) return "Small";
  if (d.includes(" medium")) return "Medium";
  if (d.includes(" large")) return "Large";
  return null;
}

function inferIsD2FromDivision(divisionRaw: string): boolean {
  const d = normalize(divisionRaw);
  return d.includes(" d2") || d.includes("d2 ");
}

function inferIsFlexFromDivision(divisionRaw: string): boolean {
  const d = normalize(divisionRaw);
  return d.includes(" flex");
}

function parseMeta(r: Row) {
  const division = String(pick(r, ["division"], ""));
  const level = inferLevelFromDivision(division);

  const ageBucket = String(r.age_bucket ?? "");
  const age = ageBucket ? titleCase(ageBucket) : inferAgeFromDivision(division);

  const isD2 = r.is_d2 !== undefined && r.is_d2 !== null ? Boolean(r.is_d2) : inferIsD2FromDivision(division);
  const isFlex = r.is_flex !== undefined && r.is_flex !== null ? Boolean(r.is_flex) : inferIsFlexFromDivision(division);

  const size =
    cleanSizeAny(r.size_effective) ||
    cleanSizeAny(r.size_raw) ||
    cleanSizeAny(pick(r, ["size", "size_bucket"], "")) ||
    inferSizeFromDivision(division);

  return { division, level, age, isD2, isFlex, size };
}

function buildTrackKey(meta: { level: string | null; age: string | null; isFlex: boolean; isD2: boolean }) {
  const parts: string[] = [];
  if (meta.level) parts.push(meta.level);
  if (meta.age) parts.push(meta.age);
  if (meta.isFlex) parts.push("Flex");
  if (meta.isD2) parts.push("D2");
  return parts.join(" ").trim();
}

/**
 * Latest non-null size wins; else last known size ever; else null (no UNKNOWN bucket).
 */
function resolveTeamSize(rowsDescByDate: Array<{ weekend: string; size: Exclude<SizeOpt, "Any"> | null }>) {
  const latestNonNull = rowsDescByDate.find((x) => !!x.size)?.size ?? null;
  if (latestNonNull) return latestNonNull;
  const anyKnown = rowsDescByDate.find((x) => !!x.size)?.size ?? null;
  return anyKnown;
}

export default function RankingsPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const programKeys = ["program", "program_name", "gym", "gym_name"];
  const teamKeys = ["team", "team_name"];
  const eventScoreKeys = ["event_score", "event_total", "total_score", "score"];
  const eventNameKeys = ["event_name", "event", "event_title", "competition_name", "competition", "event_display_name"];
  const eventIdKeys = ["event_id", "eventId", "competition_id"];
  const weekendKeys = ["weekend_date", "weekend"];
  const sourceUrlKeys = ["source_url", "sourceUrl", "url"];

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  useEffect(() => {
    let cancelled = false;

    async function loadRows() {
      setLoading(true);
      setError(null);

      let q = supabase
        .from("v_results_normalized")
        .select("*")
        .gte("weekend_date", SEASON_START)
        .order("weekend_date", { ascending: false });

      // server-side level filter
      if (filters.level !== "All") {
        q = q.ilike("division", `${filters.level}%`);
      }

      // server-side search (optional)
      const s = filters.search.trim();
      if (s.length >= 2) {
        const esc = s.replace(/,/g, "");
        q = q.or(`team.ilike.%${esc}%,program.ilike.%${esc}%,division.ilike.%${esc}%,event_name.ilike.%${esc}%`);
      }

      const { data, error } = await q;

      if (cancelled) return;

      if (error) {
        setError(error);
        setRows([]);
      } else {
        setError(null);
        setRows(data ?? []);
      }

      setLoading(false);
    }

    loadRows();
    return () => {
      cancelled = true;
    };
  }, [filters.level, filters.search]);

  // row-level filters only (NOT size)
  const filteredRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const ageNorm = normalize(filters.age);

    return rows.filter((r) => {
      const meta = parseMeta(r);

      // age
      if (filters.age !== "All") {
        const rowAge = String(r.age_bucket ?? "");
        if (rowAge) {
          if (normalize(rowAge) !== ageNorm) return false;
        } else {
          if (!normalize(meta.division).includes(ageNorm)) return false;
        }
      }

      // d2/flex
      if (filters.d2Mode === "D2Only" && !meta.isD2) return false;
      if (filters.d2Mode === "NonD2Only" && meta.isD2) return false;

      if (filters.flexMode === "FlexOnly" && !meta.isFlex) return false;
      if (filters.flexMode === "NonFlexOnly" && meta.isFlex) return false;

      // local search fallback
      if (q) {
        const eventName = String(pick(r, eventNameKeys, "")).toLowerCase();
        const program = String(pick(r, programKeys, "")).toLowerCase();
        const team = String(pick(r, teamKeys, "")).toLowerCase();
        const div = meta.division.toLowerCase();
        if (!eventName.includes(q) && !program.includes(q) && !team.includes(q) && !div.includes(q)) return false;
      }

      return true;
    });
  }, [rows, filters.age, filters.d2Mode, filters.flexMode, filters.search]);

  // Aggregate teams:
  // - dedupe to 1 score per team per comp
  // - avg across season
  // - compute "final size"
  // - apply size filter at team-level
  const teamRankings = useMemo(() => {
    type Agg = {
      key: string;
      program: string;
      team: string;
      track: string; // level+age+flex+d2 (no size)
      compScores: Map<string, number>;
      rowsByWeekendDesc: Array<{ weekend: string; size: Exclude<SizeOpt, "Any"> | null }>;
    };

    const map = new Map<string, Agg>();

    for (const r of filteredRows) {
      const program = String(pick(r, programKeys, "")).trim();
      const team = String(pick(r, teamKeys, "")).trim();
      if (!program || !team) continue;

      const meta = parseMeta(r);
      const track = buildTrackKey(meta);
      if (!track) continue;

      const teamId = String(r.team_id ?? "").trim();
      const programId = String(r.program_id ?? "").trim();

      const groupKey = teamId
        ? `${teamId}__${track}`
        : `${programId || normalize(program)}__${normalize(team)}__${track}`;

      const score = toNum(pick(r, eventScoreKeys, 0));

      const eventId = String(pick(r, eventIdKeys, "")).trim();
      const weekend = String(pick(r, weekendKeys, "")).trim();
      const eventName = String(pick(r, eventNameKeys, "")).trim();
      const sourceUrl = String(pick(r, sourceUrlKeys, "")).trim();

      const compKey = eventId ? `event:${eventId}` : sourceUrl ? `url:${sourceUrl}` : `name:${eventName}__wk:${weekend}`;

      let agg = map.get(groupKey);
      if (!agg) {
        agg = { key: groupKey, program, team, track, compScores: new Map(), rowsByWeekendDesc: [] };
        map.set(groupKey, agg);
      }

      // dedupe: keep best score per competition key
      const prev = agg.compScores.get(compKey);
      if (prev === undefined || score > prev) agg.compScores.set(compKey, score);

      agg.rowsByWeekendDesc.push({ weekend, size: meta.size });
    }

    let out = Array.from(map.values()).map((a) => {
      a.rowsByWeekendDesc.sort((x, y) => (y.weekend || "").localeCompare(x.weekend || ""));
      const sizeFinal = resolveTeamSize(a.rowsByWeekendDesc); // may be null

      const scores = Array.from(a.compScores.values());
      const comps = scores.length;
      const avg = comps ? scores.reduce((x, y) => x + y, 0) / comps : 0;

      // if never size -> just track (no UNKNOWN)
      const bucket = sizeFinal ? `${a.track} ${sizeFinal}` : a.track;

      return {
        key: a.key,
        program: a.program,
        team: a.team,
        bucket,
        size_final: sizeFinal,
        avg,
        comps,
      };
    });

    // default: only 2+ comps
    if (filters.requireTwoPlus) out = out.filter((x) => x.comps >= 2);

    // size filter at team-level
    if (filters.size !== "Any") {
      out = out.filter((x) => x.size_final && normalize(x.size_final) === normalize(filters.size));
    }

    out.sort((x, y) => y.avg - x.avg);
    return out;
  }, [filteredRows, filters.requireTwoPlus, filters.size]);

  const chartTop10 = useMemo(
    () =>
      teamRankings.slice(0, 10).map((t) => ({
        key: t.key,
        label: t.team,
        legendLabel: `${t.program} — ${t.team}`,
        value: t.avg,
      })),
    [teamRankings]
  );

  const tableTop20 = useMemo(() => teamRankings.slice(0, 20), [teamRankings]);

  const ageOptions: AgeOpt[] = ["All", "Tiny", "Mini", "Youth", "Junior", "Senior", "U16", "U18", "Open"];

  const emptyHint = filters.requireTwoPlus
    ? "No teams match. Default excludes teams with only 1 competition — toggle '2+ comps' off to include them."
    : "No teams match your current filters.";

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-100">Rankings</h1>
          <p className="mt-2 text-slate-300">
            Season average event score per team (since{" "}
            <span className="font-semibold text-slate-200">{SEASON_START}</span>).
          </p>
        </div>
        <div className="text-xs text-slate-400">{loading ? "Loading…" : `${rows.length.toLocaleString()} rows loaded`}</div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7 md:items-end">
          <label className="grid gap-1 md:col-span-2">
            <span className="text-xs text-slate-300">Search</span>
            <input
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              placeholder="Team / program / division / event…"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-300">Level</span>
            <select
              value={filters.level}
              onChange={(e) => setFilter("level", e.target.value as any)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none"
            >
              <option value="All">All</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={`L${n}`}>{`L${n}`}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-300">Age</span>
            <select
              value={filters.age}
              onChange={(e) => setFilter("age", e.target.value as any)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none"
            >
              {ageOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-300">D2</span>
            <select
              value={filters.d2Mode}
              onChange={(e) => setFilter("d2Mode", e.target.value as any)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none"
            >
              <option value="Any">Any</option>
              <option value="D2Only">D2</option>
              <option value="NonD2Only">Non</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-300">Flex</span>
            <select
              value={filters.flexMode}
              onChange={(e) => setFilter("flexMode", e.target.value as any)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none"
            >
              <option value="Any">Any</option>
              <option value="FlexOnly">Flex</option>
              <option value="NonFlexOnly">Non</option>
            </select>
          </label>

          <div className="flex items-center justify-between gap-3 md:justify-end">
            {/* Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300">2+ comps</span>
              <button
                type="button"
                onClick={() => setFilter("requireTwoPlus", !filters.requireTwoPlus)}
                aria-pressed={filters.requireTwoPlus}
                className={`relative h-10 w-20 rounded-full border border-white/15 ${
                  filters.requireTwoPlus ? "bg-white/15" : "bg-white/5"
                }`}
                title={filters.requireTwoPlus ? "Excluding 1-comp teams" : "Including 1-comp teams"}
              >
                <span
                  className={`absolute top-1 h-8 w-8 rounded-full bg-white/90 transition-all ${
                    filters.requireTwoPlus ? "left-11" : "left-1"
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-100 hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs text-slate-300">Size</span>
            <select
              value={filters.size}
              onChange={(e) => setFilter("size", e.target.value as any)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none"
            >
              <option value="Any">Any</option>
              <option value="X-Small">XS</option>
              <option value="Small">Small</option>
              <option value="Medium">Medium</option>
              <option value="Large">Large</option>
              <option value="X-Large">XL</option>
            </select>
          </label>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="font-semibold text-red-200">Error</div>
          <pre className="mt-2 overflow-x-auto text-xs text-red-100">{JSON.stringify(error, null, 2)}</pre>
        </div>
      )}

      {/* ✅ Minimal-effort mobile width fix: min-width + horizontal scroll inside the card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Top 10 — Average Event Score</h2>
            <p className="text-sm text-slate-400">Season average event score per team.</p>
          </div>
          <div className="text-xs text-slate-400">
            Teams: <span className="font-semibold text-slate-200">{chartTop10.length}</span>
          </div>
        </div>

        <div className="-mx-5 mt-4 overflow-x-auto px-5">
          <div className="min-w-[860px]">
            <BarRankingsChart items={chartTop10} />
          </div>
        </div>

        {!loading && chartTop10.length === 0 && (
          <div className="mt-3 text-sm text-slate-400">{emptyHint}</div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Top 20</div>
            <div className="text-xs text-slate-400">Season avg event score</div>
          </div>
        </div>

        {!loading && !error && tableTop20.length === 0 ? (
          <div className="p-6 text-slate-200">{emptyHint}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-slate-200">
                <tr className="text-left">
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Team</th>
                  <th className="px-3 py-3">Program</th>
                  <th className="px-3 py-3">Division Bucket</th>
                  <th className="px-3 py-3 text-right">Avg</th>
                  <th className="px-3 py-3 text-right">Comps</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {tableTop20.map((t, idx) => (
                  <tr key={t.key} className="text-slate-100 hover:bg-white/5">
                    <td className="px-3 py-3 text-slate-300">{idx + 1}</td>
                    <td className="px-3 py-3 font-semibold">{t.team}</td>
                    <td className="px-3 py-3 text-slate-200">{t.program}</td>
                    <td className="px-3 py-3 text-slate-200">{t.bucket}</td>
                    <td className="px-3 py-3 text-right font-semibold">{t.avg.toFixed(3)}</td>
                    <td className="px-3 py-3 text-right text-slate-200">{t.comps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500">
        Avg is across unique competitions (event_id preferred; else source_url; else event_name + weekend_date). Team Size is latest
        non-null size; if none recently, last known size; if never any size, division remains without size.
      </div>
    </main>
  );
}