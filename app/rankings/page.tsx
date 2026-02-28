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
 * Latest non-null size wins; if none recently, last known size ever; if never any size => null.
 */
function resolveTeamSize(rowsDescByDate: Array<{ weekend: string; size: Exclude<SizeOpt, "Any"> | null }>) {
  const latestNonNull = rowsDescByDate.find((x) => !!x.size)?.size ?? null;
  if (latestNonNull) return latestNonNull;
  const anyKnown = rowsDescByDate.find((x) => !!x.size)?.size ?? null;
  return anyKnown; // null if never any size
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

  const controlLabel: React.CSSProperties = { fontSize: 12, opacity: 0.75 };
  const controlBase: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "white",
  };

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

      // Server-side level filter
      if (filters.level !== "All") {
        q = q.ilike("division", `${filters.level}%`);
      }

      // Server-side search (optional)
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

  // Row-level filters only (NOT size)
  const filteredRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const ageNorm = normalize(filters.age);

    return rows.filter((r) => {
      const meta = parseMeta(r);

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

      // Search fallback for short queries
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

  // Aggregate teams, compute avg across ALL comps, determine final size, then apply size filter at team-level
  const teamRankings = useMemo(() => {
    type Agg = {
      key: string;
      program: string;
      team: string;
      track: string; // no size
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

      // Prefer team_id (your data is stable), fallback to program_id+name
      const teamId = String(r.team_id ?? "").trim();
      const programId = String(r.program_id ?? "").trim();
      const groupKey = teamId ? `${teamId}__${track}` : `${programId || normalize(program)}__${normalize(team)}__${track}`;

      const score = toNum(pick(r, eventScoreKeys, 0));

      const eventId = String(pick(r, eventIdKeys, "")).trim();
      const weekend = String(pick(r, weekendKeys, "")).trim();
      const eventName = String(pick(r, eventNameKeys, "")).trim();
      const sourceUrl = String(pick(r, sourceUrlKeys, "")).trim();

      // Dedup: event_id -> source_url -> event_name+weekend
      const compKey = eventId ? `event:${eventId}` : sourceUrl ? `url:${sourceUrl}` : `name:${eventName}__wk:${weekend}`;

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

      const sizeFinal = resolveTeamSize(a.rowsByWeekendDesc); // may be null
      const scores = Array.from(a.compScores.values());
      const comps = scores.length;
      const avg = comps ? scores.reduce((x, y) => x + y, 0) / comps : 0;

      // If never any size ever, bucket is just the division track (no UNKNOWN token)
      const bucket = sizeFinal ? `${a.track} ${sizeFinal}` : a.track;

      return {
        key: a.key,
        program: a.program,
        team: a.team,
        track: a.track,
        size_final: sizeFinal, // null if never any size ever
        bucket,
        avg,
        comps,
      };
    });

    if (filters.requireTwoPlus) out = out.filter((x) => x.comps >= 2);

    // Team-level size filter (null never matches)
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
    <main style={{ padding: 20, maxWidth: 1200, margin: "0 auto", color: "white" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Rankings</h1>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          {loading ? "Loading season data…" : `${rows.length.toLocaleString()} season rows (since ${SEASON_START})`}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: "rgba(255,0,0,0.12)",
            border: "1px solid rgba(255,0,0,0.25)",
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Error</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(error, null, 2)}</pre>
        </div>
      )}

      {/* Filters */}
      <div style={{ maxWidth: 1100, margin: "0 auto 16px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 120px 140px 120px 120px 150px auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={controlLabel}>Search</span>
            <input
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              placeholder="Team / program / division / event…"
              style={{ ...controlBase, width: "100%", outline: "none" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={controlLabel}>Level</span>
            <select
              value={filters.level}
              onChange={(e) => setFilter("level", e.target.value as any)}
              style={{ ...controlBase, width: "100%", paddingRight: 28 }}
            >
              <option value="All">All</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={`L${n}`}>{`L${n}`}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={controlLabel}>Age</span>
            <select
              value={filters.age}
              onChange={(e) => setFilter("age", e.target.value as any)}
              style={{ ...controlBase, width: "100%", paddingRight: 28 }}
            >
              {ageOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={controlLabel}>Flex</span>
            <select
              value={filters.flexMode}
              onChange={(e) => setFilter("flexMode", e.target.value as any)}
              style={{ ...controlBase, width: "100%", paddingRight: 28 }}
            >
              <option value="Any">Any</option>
              <option value="FlexOnly">Flex</option>
              <option value="NonFlexOnly">Non</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={controlLabel}>D2</span>
            <select
              value={filters.d2Mode}
              onChange={(e) => setFilter("d2Mode", e.target.value as any)}
              style={{ ...controlBase, width: "100%", paddingRight: 28 }}
            >
              <option value="Any">Any</option>
              <option value="D2Only">D2</option>
              <option value="NonD2Only">Non</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={controlLabel}>Size</span>
            <select
              value={filters.size}
              onChange={(e) => setFilter("size", e.target.value as any)}
              style={{ ...controlBase, width: "100%", paddingRight: 28 }}
            >
              <option value="Any">Any</option>
              <option value="X-Small">XS</option>
              <option value="Small">S</option>
              <option value="Medium">M</option>
              <option value="Large">L</option>
              <option value="X-Large">XL</option>
            </select>
          </label>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
            {/* Toggle: 2+ comps */}
            <div style={{ display: "grid", gap: 6 }}>
              <span style={controlLabel}>2+ comps</span>
              <button
                type="button"
                onClick={() => setFilter("requireTwoPlus", !filters.requireTwoPlus)}
                aria-pressed={filters.requireTwoPlus}
                style={{
                  height: 42,
                  width: 86,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: filters.requireTwoPlus ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)",
                  cursor: "pointer",
                  position: "relative",
                }}
                title={filters.requireTwoPlus ? "Excluding 1-comp teams" : "Including 1-comp teams"}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    left: filters.requireTwoPlus ? 44 : 4,
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.90)",
                    transition: "left 160ms ease",
                  }}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              style={{
                height: 42,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "white",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Chart (mobile: same behavior as Team Search: no shrinking, horizontal scroll) */}
      <div style={{ maxWidth: 1100, margin: "0 auto 14px" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {/* minWidth keeps it readable on mobile; swipe to see full chart */}
          <div style={{ minWidth: 900 }}>
            <BarRankingsChart items={chartTop10} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Top 20</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Season avg event score</div>
        </div>

        {!loading && tableTop20.length === 0 ? (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
              opacity: 0.85,
            }}
          >
            {emptyHint}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 860 }}>
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.85, borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  <th style={{ padding: "10px 8px" }}>#</th>
                  <th style={{ padding: "10px 8px" }}>Team</th>
                  <th style={{ padding: "10px 8px" }}>Program</th>
                  <th style={{ padding: "10px 8px" }}>Division</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>Avg</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>Comps</th>
                </tr>
              </thead>
              <tbody>
                {tableTop20.map((t, idx) => (
                  <tr key={t.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={{ padding: "10px 8px" }}>{idx + 1}</td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{t.team}</td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{t.program}</td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap", opacity: 0.9 }}>{t.bucket}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>{t.avg.toFixed(3)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", whiteSpace: "nowrap", opacity: 0.85 }}>
                      {t.comps}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>
          Avg is across unique competitions (event_id preferred; else source_url; else event_name + weekend_date). Team Size is
          latest non-null size; if none recently, last known size; if never any size, division remains without size.
        </div>
      </div>
    </main>
  );
}