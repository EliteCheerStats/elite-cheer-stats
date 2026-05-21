"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BarRankingsChart } from "./BarRankingsChart";
import Link from "next/link";

type SizeOpt = "Any" | "X-Small" | "Small" | "Medium" | "Large";
type D2Mode = "Any" | "D2Only" | "NonD2Only";
type FlexMode = "Any" | "FlexOnly" | "NonFlexOnly";
type CoedMode = "Any" | "CoedOnly" | "NonCoedOnly";
type LevelOpt = "All" | "L1" | "L2" | "L3" | "L4" | "L4.2" | "L5" | "L6";
type AgeOpt = "All" | "Tiny" | "Mini" | "Youth" | "Junior" | "Senior";

type Filters = {
  level: LevelOpt;
  age: AgeOpt;
  d2Mode: D2Mode;
  flexMode: FlexMode;
  coedMode: CoedMode;
  size: SizeOpt;
};

type RankingRow = {
  team_id: string;
  program_id: string | null;
  program: string;
  team: string;
  level_code: string | null;
  age_bucket: string | null;
  is_d2: boolean | null;
  is_flex: boolean | null;
  is_coed: boolean | null;
  size_effective: string | null;
  latest_division: string | null;
  division_bucket: string | null;
  avg_event_score: number | string | null;
  avg_ceiling_score: number | string | null;
  best_event_score: number | string | null;
  comps: number | string | null;
};

const DEFAULT_FILTERS: Filters = {
  level: "All",
  age: "All",
  d2Mode: "Any",
  flexMode: "Any",
  coedMode: "Any",
  size: "Any",
};

const ACTIVE_SEASON_LABEL = "2025-2026 Season";

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

export default function RankingsPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<any>(null);

  const [premiumLoading, setPremiumLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [session, setSession] = useState<any>(null);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));

    if (hasSearched) {
      setRows([]);
      setHasSearched(false);
      setError(null);
    }
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setRows([]);
    setHasSearched(false);
    setError(null);
    setLoading(false);
  };

  async function loadRows() {
    setHasSearched(true);
    setLoading(true);
    setError(null);

    let q = supabase
      .from("mv_rankings_rebuilt")
      .select(`
        team_id,
        program_id,
        program,
        team,
        level_code,
        age_bucket,
        is_d2,
        is_flex,
        is_coed,
        size_effective,
        latest_division,
        division_bucket,
        avg_event_score,
        avg_ceiling_score,
        best_event_score,
        comps
      `)
      .order("avg_event_score", { ascending: false })
      .limit(200);

    if (filters.level !== "All") {
      q = q.eq("level_code", filters.level);
    }

    if (filters.age !== "All") {
      q = q.ilike("age_bucket", filters.age);
    }

    if (filters.d2Mode === "D2Only") {
      q = q.eq("is_d2", true);
    }

    if (filters.d2Mode === "NonD2Only") {
      q = q.eq("is_d2", false);
    }

    if (filters.flexMode === "FlexOnly") {
      q = q.eq("is_flex", true);
    }

    if (filters.flexMode === "NonFlexOnly") {
      q = q.eq("is_flex", false);
    }

    if (filters.coedMode === "CoedOnly") {
      q = q.eq("is_coed", true);
    }

    if (filters.coedMode === "NonCoedOnly") {
      q = q.eq("is_coed", false);
    }

    if (filters.size !== "Any") {
      q = q.eq("size_effective", filters.size);
    }

    const { data, error } = await q;

    if (error) {
      setError(error);
      setRows([]);
    } else {
      setError(null);
      setRows((data ?? []) as RankingRow[]);
    }

    setLoading(false);
  }

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

  const teamRankings = useMemo(() => {
    return rows
      .map((r) => ({
        key: String(r.team_id),
        program: String(r.program ?? ""),
        team: String(r.team ?? ""),
        bucket: String(r.division_bucket ?? r.latest_division ?? ""),
        avg: toNum(r.avg_event_score),
        comps: Number(r.comps ?? 0),
      }))
      .filter((r) => r.program && r.team && r.avg > 0)
      .sort((a, b) => b.avg - a.avg);
  }, [rows]);

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

  const emptyHint = hasSearched
    ? "No teams match your current filters."
    : "Choose filters, then click Search to view rankings.";

  const rankingsCtaHref = session?.user ? "/upgrade" : "/login";
  const showRankingsCta = !premiumLoading && !isPremium;

  return (
    <main className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-100">
            Rankings
          </h1>

          <p className="mt-2 text-sm text-slate-300">
            Top 10 is just the starting point — teams ranked 11–20 are separating fast this week.
          </p>

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

          <p className="mt-4 text-slate-300">
            Season average event score per team —{" "}
            <span className="font-semibold text-slate-200">{ACTIVE_SEASON_LABEL}</span>.
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Scores sourced from Varsity competition results.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400">
            {loading
              ? "Searching…"
              : hasSearched
              ? `${rows.length.toLocaleString()} rankings loaded`
              : "Choose filters, then search"}
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

          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadRows}
              disabled={loading}
              className="h-10 flex-1 rounded-xl border border-teal-400/40 bg-teal-400/10 px-4 text-sm font-semibold text-teal-300 hover:bg-teal-400/20 disabled:opacity-50"
            >
              {loading ? "Searching…" : "Search"}
            </button>

            <button
              type="button"
              onClick={clearFilters}
              disabled={loading}
              className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
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
            <h2 className="text-lg font-bold text-slate-100">
              Top 10 — {rankingLabel || "All Teams"}
            </h2>
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
            <div className="text-sm font-semibold text-slate-100">Top 20</div>

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
