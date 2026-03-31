"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BarRankingsChart } from "./BarRankingsChart";
import Link from "next/link";

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

async function handleShare() {
  const url = window.location.href;
  const title = "Elite Cheer Stats Rankings";
  const text = "Check out these rankings on Elite Cheer Stats";

  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }

    await navigator.clipboard.writeText(url);
    window.alert("Link copied to clipboard");
  } catch (err) {
    console.error("Share failed:", err);
  }
}

function titleCase(s: string) {
  const t = normalize(s);
  if (!t) return "";
  return t.replace(/\b\w/g, (m) => m.toUpperCase());
}

type SizeOpt = "Any" | "X-Small" | "Small" | "Medium" | "Large";
type D2Mode = "Any" | "D2Only" | "NonD2Only";
type FlexMode = "Any" | "FlexOnly" | "NonFlexOnly";
type CoedMode = "Any" | "CoedOnly" | "NonCoedOnly";
type LevelOpt = "All" | "L1" | "L2" | "L3" | "L4" | "L4.2" | "L5" | "L6";
type AgeOpt = "All" | "Tiny" | "Mini" | "Youth" | "Junior" | "Senior";

type Filters = {
  search: string;
  level: LevelOpt;
  age: AgeOpt;
  d2Mode: D2Mode;
  flexMode: FlexMode;
  coedMode: CoedMode;
  size: SizeOpt;
  requireTwoPlus: boolean; // default ON
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  level: "All",
  age: "All",
  d2Mode: "Any",
  flexMode: "Any",
  coedMode: "Any",
  size: "Any",
  requireTwoPlus: true,
};

const SEASON_START = "2025-12-01";


// ---------- Parsing helpers ----------
function inferLevelFromDivision(divisionRaw: string): string | null {
  const d = String(divisionRaw ?? "").trim();
  const m = d.match(/^\s*(L\d+(?:\.\d+)?)/i);
  return m ? m[1].toUpperCase() : null;
}

function inferAgeFromDivision(divisionRaw: string): string | null {
  const d = normalize(divisionRaw);
  const candidates: Array<[string, string]> = [
    ["tiny", "Tiny"],
    ["mini", "Mini"],
    ["youth", "Youth"],
    ["junior", "Junior"],
    ["senior", "Senior"],
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
  return null;
}

function inferSizeFromDivision(divisionRaw: string): Exclude<SizeOpt, "Any"> | null {
  const d = normalize(divisionRaw);
  if (d.includes("x-small") || d.includes("x small") || d.includes("xsmall")) return "X-Small";
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

function inferIsCoedFromDivision(divisionRaw: string): boolean {
  const d = normalize(divisionRaw);
  return /\bcoed\b/.test(d);
}

function parseMeta(r: Row) {
  const division = String(pick(r, ["division"], ""));
  const level = inferLevelFromDivision(division);

  const ageBucket = String(r.age_bucket ?? "");
  const age = ageBucket ? titleCase(ageBucket) : inferAgeFromDivision(division);

  const isD2 = r.is_d2 !== undefined && r.is_d2 !== null ? Boolean(r.is_d2) : inferIsD2FromDivision(division);
  const isFlex = r.is_flex !== undefined && r.is_flex !== null ? Boolean(r.is_flex) : inferIsFlexFromDivision(division);
  const isCoed = r.is_coed !== undefined && r.is_coed !== null ? Boolean(r.is_coed) : inferIsCoedFromDivision(division);

  const size =
    cleanSizeAny(r.size_effective) ||
    cleanSizeAny(r.size_raw) ||
    cleanSizeAny(pick(r, ["size", "size_bucket"], "")) ||
    inferSizeFromDivision(division);

  return { division, level, age, isD2, isFlex, isCoed, size };
}

function isSupportedForRankings(meta: {
  division: string;
  level: string | null;
  age: string | null;
  size: string | null;
}) {
  const d = normalize(meta.division);

  if (meta.level === "L7") return false;
  if (meta.age === "U16" || meta.age === "U18" || meta.age === "Open") return false;
  if (d.includes("u16") || d.includes("u18") || d.includes(" open")) return false;
  if (meta.size === "X-Large") return false;

  return true;
}

function buildTrackKey(meta: {
  level: string | null;
  age: string | null;
  isFlex: boolean;
  isD2: boolean;
  isCoed: boolean;
}) {
  const parts: string[] = [];
  if (meta.level) parts.push(meta.level);
  if (meta.age) parts.push(meta.age);
  if (meta.isCoed) parts.push("Coed");
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
  const [premiumLoading, setPremiumLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [session, setSession] = useState<any>(null);
  const programKeys = ["program", "program_name", "gym", "gym_name"];
  const teamKeys = ["team", "team_name"];
  const eventScoreKeys = ["event_score", "event_total", "total_score", "score"];
  const eventNameKeys = ["event_name", "event", "event_title", "competition_name", "competition", "event_display_name"];
  const eventIdKeys = ["event_id", "eventId", "competition_id"];
  const weekendKeys = ["event_start_date", "weekend_date", "weekend"];
  const sourceUrlKeys = ["source_url", "sourceUrl", "url"];

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

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

      const { data, error } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("rankings premium check error:", error);
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

    const handleFocus = () => {
      checkPremium();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRows() {
      setLoading(true);
      setError(null);

      let q = supabase
        .from("v_team_event_scores")
        .select("*")
        .gte("weekend_date", SEASON_START)
        .order("weekend_date", { ascending: false });

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
  }, [filters.search]);

  const filteredRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const ageNorm = normalize(filters.age);

    return rows.filter((r) => {
      const meta = parseMeta(r);
      if (!isSupportedForRankings(meta)) return false;

      if (filters.level !== "All" && meta.level !== filters.level) return false;

      if (filters.age !== "All") {
        const rowAge = String(r.age_bucket ?? "");
        if (rowAge) {
          if (normalize(rowAge) !== ageNorm) return false;
        } else {
          if (!normalize(meta.division).includes(ageNorm)) return false;
        }
      }

      if (filters.d2Mode === "D2Only" && !meta.isD2) return false;
      if (filters.d2Mode === "NonD2Only" && meta.isD2) return false;

      if (filters.flexMode === "FlexOnly" && !meta.isFlex) return false;
      if (filters.flexMode === "NonFlexOnly" && meta.isFlex) return false;

      if (filters.coedMode === "CoedOnly" && !meta.isCoed) return false;
      if (filters.coedMode === "NonCoedOnly" && meta.isCoed) return false;

      if (q) {
        const eventName = String(pick(r, eventNameKeys, "")).toLowerCase();
        const program = String(pick(r, programKeys, "")).toLowerCase();
        const team = String(pick(r, teamKeys, "")).toLowerCase();
        const div = meta.division.toLowerCase();
        if (!eventName.includes(q) && !program.includes(q) && !team.includes(q) && !div.includes(q)) return false;
      }

      return true;
    });
  }, [rows, filters.level, filters.age, filters.d2Mode, filters.flexMode, filters.coedMode, filters.search]);

  const teamRankings = useMemo(() => {
    type Agg = {
      key: string;
      program: string;
      team: string;
      track: string;
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

      const compKey = eventId
        ? `event:${eventId}`
        : sourceUrl
        ? `url:${sourceUrl}`
        : `name:${eventName}__wk:${weekend}`;

      let agg = map.get(groupKey);
      if (!agg) {
        agg = { key: groupKey, program, team, track, compScores: new Map(), rowsByWeekendDesc: [] };
        map.set(groupKey, agg);
      }

      const prev = agg.compScores.get(compKey);
      if (prev === undefined || score > prev) agg.compScores.set(compKey, score);

      agg.rowsByWeekendDesc.push({ weekend, size: meta.size });
    }

    let out = Array.from(map.values()).map((a) => {
      a.rowsByWeekendDesc.sort((x, y) => (y.weekend || "").localeCompare(x.weekend || ""));
      const sizeFinal = resolveTeamSize(a.rowsByWeekendDesc);

      const scores = Array.from(a.compScores.values());
      const comps = scores.length;
      const avg = comps ? scores.reduce((x, y) => x + y, 0) / comps : 0;

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

    if (filters.requireTwoPlus) out = out.filter((x) => x.comps >= 2);

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

  const ageOptions: AgeOpt[] = ["All", "Tiny", "Mini", "Youth", "Junior", "Senior"];

  const rankingLabel = [
    filters.level !== "All" ? filters.level.replace(/^L/, "Level ") : null,
    filters.age !== "All" ? filters.age : null,
    filters.coedMode === "CoedOnly" ? "Coed" : filters.coedMode === "NonCoedOnly" ? "Non-Coed" : null,
    filters.flexMode === "FlexOnly" ? "Flex" : null,
    filters.d2Mode === "D2Only" ? "D2" : null,
    filters.size !== "Any" ? filters.size : null,
  ]
    .filter(Boolean)
    .join(" ");

  const emptyHint = filters.requireTwoPlus
    ? "No teams match. Default excludes teams with only 1 competition — toggle '2+ comps' off to include them."
    : "No teams match your current filters.";

  const rankingsCtaHref = session?.user ? "/upgrade" : "/login";
  const showRankingsCta = !premiumLoading && !isPremium;

  return (
    <main className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-100">
    Rankings
  </h1>

  {/* 🔥 NEW PRESSURE LINE */}
  <p className="mt-2 text-sm text-slate-300">
    Top 10 is just the starting point — teams ranked 11–20 are separating fast this week.
  </p>

  {/* 🔥 NEW CTA ROW */}
  <div className="mt-3 flex flex-wrap items-center gap-3">
  <Link
    href="/compare"
    className="inline-flex items-center justify-center rounded-xl border border-teal-400/40 bg-teal-400/10 px-5 py-2 text-sm font-semibold text-teal-300 hover:bg-teal-400/20 transition-colors"
  >
    Compare Teams →
  </Link>

  <Link
    href="/comp-builder"
    className="inline-flex items-center justify-center rounded-xl border border-teal-400/40 bg-teal-400/10 px-5 py-2 text-sm font-semibold text-teal-300 hover:bg-teal-400/20 transition-colors"
  >
    Build Lineup
  </Link>
</div>
  {/* EXISTING TEXT (moved down) */}
  <p className="mt-4 text-slate-300">
    Season average event score per team (since{" "}
    <span className="font-semibold text-slate-200">{SEASON_START}</span>).
  </p>

  <p className="mt-1 text-xs text-slate-400">
    Scores sourced from Varsity competition results.
  </p>
</div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400">
            {loading ? "Loading…" : `${rows.length.toLocaleString()} rows loaded`}
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-100 hover:bg-white/10"
          >
            Share
          </button>
        </div>
      </div>

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
              onChange={(e) => setFilter("level", e.target.value as Filters["level"])}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none"
            >
              <option value="All">All</option>
              <option value="L1">L1</option>
              <option value="L2">L2</option>
              <option value="L3">L3</option>
              <option value="L4">L4</option>
              <option value="L4.2">L4.2</option>
              <option value="L5">L5</option>
              <option value="L6">L6</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-300">Age</span>
            <select
              value={filters.age}
              onChange={(e) => setFilter("age", e.target.value as Filters["age"])}
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
              onChange={(e) => setFilter("d2Mode", e.target.value as Filters["d2Mode"])}
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
              onChange={(e) => setFilter("flexMode", e.target.value as Filters["flexMode"])}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none"
            >
              <option value="Any">Any</option>
              <option value="FlexOnly">Flex</option>
              <option value="NonFlexOnly">Non</option>
            </select>
          </label>

          <div className="flex items-center justify-between gap-3 md:justify-end">
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

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-xs text-slate-300">Size</span>
            <select
              value={filters.size}
              onChange={(e) => setFilter("size", e.target.value as Filters["size"])}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none"
            >
              <option value="Any">Any</option>
              <option value="X-Small">XS</option>
              <option value="Small">Small</option>
              <option value="Medium">Medium</option>
              <option value="Large">Large</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-300">Coed</span>
            <select
              value={filters.coedMode}
              onChange={(e) => setFilter("coedMode", e.target.value as Filters["coedMode"])}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none"
            >
              <option value="Any">Any</option>
              <option value="CoedOnly">Coed</option>
              <option value="NonCoedOnly">Non-Coed</option>
            </select>
          </label>


        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="font-semibold text-red-200">Error</div>
          <pre className="mt-2 overflow-x-auto text-xs text-red-100">{JSON.stringify(error, null, 2)}</pre>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Top 10 — {rankingLabel || "All Teams"}</h2>
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

      <div className="rounded-2xl border border-white/10 bg-white/5">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-100">
              Top 20
            </div>

            <div>
              {showRankingsCta ? (
                <Link
                  href={rankingsCtaHref}
                  className="rounded-md bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:opacity-90"
                >
                  {session?.user ? "Unlock Full Rankings" : "Create Account"}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-1 text-xs text-slate-400">
            See where your team actually ranks 👀
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
                {tableTop20.slice(0, 10).map((t, idx) => (
                  <tr key={t.key} className="text-slate-100 hover:bg-white/5">
                    <td className="px-3 py-3 text-slate-300">{idx + 1}</td>
                    <td className="px-3 py-3 font-semibold">{t.team}</td>
                    <td className="px-3 py-3 text-slate-200">{t.program}</td>
                    <td className="px-3 py-3 text-slate-200">{t.bucket}</td>
                    <td className="px-3 py-3 text-right font-semibold">
                      {t.avg.toFixed(3)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-200">{t.comps}</td>
                  </tr>
                ))}

                {tableTop20.slice(10, 20).map((t, idx) => (
                  <tr key={t.key}>
                    <td className="px-3 py-3 text-slate-500">{idx + 11}</td>

                    {!premiumLoading && isPremium ? (
                      <>
                        <td className="px-3 py-3 font-semibold">{t.team}</td>
                        <td className="px-3 py-3 text-slate-200">{t.program}</td>
                        <td className="px-3 py-3 text-slate-200">{t.bucket}</td>
                        <td className="px-3 py-3 text-right font-semibold">
                          {t.avg.toFixed(3)}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-200">
                          {t.comps}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-3 text-slate-400 font-medium">
  {idx < 3
    ? "Teams 11–20 are closing fast 👀"
    : idx < 6
    ? "The gap is tighter than you think 👀"
    : idx < 8
    ? "This could flip this weekend 👀"
    : "You don’t have the full picture yet 🔒"}
</td>
                        <td className="px-3 py-3 text-slate-500">92.8 — 96.1</td>
                        <td className="px-3 py-3 text-slate-500">↗ trending</td>
                        <td className="px-3 py-3 text-right text-slate-500">•••••</td>
                        <td className="px-3 py-3 text-right text-slate-500">••</td>
                      </>
                    )}
                  </tr>
                ))}

                {!premiumLoading && !isPremium && tableTop20.length > 10 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6">
                      <div className="rounded-2xl border border-white/10 bg-[#131f3a]/95 p-5 text-center">
                        <div className="text-lg font-bold text-white">
  Top 10 is just the starting point 👀
</div>
<div className="mt-2 text-sm text-white/70">
  Teams ranked 11–20 are separating fast this week. Unlock full rankings and compare who’s actually in the mix.
</div>

                        <div className="mt-4 flex justify-center gap-3">
                          <Link
                            href={rankingsCtaHref}
                            className="rounded-md bg-teal-400 px-4 py-2 font-semibold text-slate-900 hover:opacity-90"
                          >
                            {session?.user ? "Unlock Full Rankings" : "Create Account"}
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500">
        Rankings are calculated using real competition scores from this season — based on available results — no opinions, just outcomes.
      </div>
    </main>
  );
}