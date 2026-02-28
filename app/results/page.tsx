"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Row = Record<string, any>;

function pick(row: Row, candidates: string[], fallback = "") {
  for (const key of candidates) {
    const v = row[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
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

const SEASON_START = "2025-12-01";

// ---------- parsing helpers (same as Rankings) ----------
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
 * Same Size policy as Rankings:
 * - latest non-null size wins
 * - else last known size ever
 * - else null (and we DO NOT show "Unknown"; bucket is just track)
 */
function resolveTeamSize(rowsDescByDate: Array<{ weekend: string; size: Exclude<SizeOpt, "Any"> | null }>) {
  const latestNonNull = rowsDescByDate.find((x) => !!x.size)?.size ?? null;
  if (latestNonNull) return latestNonNull;

  const anyKnown = rowsDescByDate.find((x) => !!x.size)?.size ?? null;
  return anyKnown; // null if never had size ever
}

export default function ResultsExplorerPage() {
  // Data
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Weekends
  const [weekendOptions, setWeekendOptions] = useState<string[]>([]);
  const ALL_WEEKENDS = "__ALL__";
  const [weekendDate, setWeekendDate] = useState<string>(ALL_WEEKENDS);

  // Filters
  const [level, setLevel] = useState<LevelOpt>("All");
  const [age, setAge] = useState<AgeOpt>("All");
  const [d2Mode, setD2Mode] = useState<D2Mode>("Any");
  const [flexMode, setFlexMode] = useState<FlexMode>("Any");
  const [size, setSize] = useState<SizeOpt>("Any");
  const [search, setSearch] = useState<string>("");

  // ✅ Season-wide team-size map (so weekend filters don’t lose “ever small” history)
  // key = `${team_id||program_id||program}__${team}__${track}`
  const [teamFinalSizeMap, setTeamFinalSizeMap] = useState<Map<string, Exclude<SizeOpt, "Any"> | null>>(
    () => new Map()
  );

  const clip: React.CSSProperties = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  // Column candidates
  const eventNameKeys = ["event_name", "event", "event_title", "competition_name", "competition", "event_display_name"];
  const programKeys = ["program", "program_name", "gym", "gym_name"];
  const teamKeys = ["team", "team_name"];
  const eventIdKeys = ["event_id", "eventId", "competition_id"];
  const weekendKeys = ["weekend_date", "weekend"];
  const eventScoreKeys = ["event_score", "event_total", "total_score", "score"];
  const sourceUrlKeys = ["source_url", "sourceUrl", "url"];

  const ageOptions: AgeOpt[] = ["All", "Tiny", "Mini", "Youth", "Junior", "Senior", "U16", "U18", "Open"];

  // 1) Load weekends
  useEffect(() => {
    let cancelled = false;

    async function loadWeekends() {
      setError(null);

      const { data, error } = await supabase
        .from("v_available_weekends")
        .select("weekend_date")
        .order("weekend_date", { ascending: true });

      if (cancelled) return;

      if (error) {
        setError(error);
        return;
      }

      const options = (data ?? []).map((r: any) => r.weekend_date).filter(Boolean);
      setWeekendOptions(options);
    }

    loadWeekends();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Load season-wide size history to compute final team size (latest non-null else last-known)
  useEffect(() => {
    let cancelled = false;

    async function loadSizeHistory() {
      // minimal columns for size resolution + track resolution
      const { data, error } = await supabase
        .from("v_results_normalized")
        .select("team_id,program_id,program,team,weekend_date,division,age_bucket,is_flex,is_d2,size_effective,size_raw")
        .gte("weekend_date", SEASON_START)
        .order("weekend_date", { ascending: false });

      if (cancelled) return;

      if (error) {
        // don't hard-fail explorer; just skip size map
        console.error("Failed to load size history:", error);
        setTeamFinalSizeMap(new Map());
        return;
      }

      type Hist = {
        weekend: string;
        size: Exclude<SizeOpt, "Any"> | null;
      };

      const bucketToHist = new Map<string, Hist[]>();

      for (const r of data ?? []) {
        const program = String(r.program ?? "").trim();
        const team = String(r.team ?? "").trim();
        if (!program || !team) continue;

        const meta = parseMeta(r as any);
        const track = buildTrackKey(meta);
        if (!track) continue;

        const teamId = String((r as any).team_id ?? "").trim();
        const programId = String((r as any).program_id ?? "").trim();
        const stableTeamKey = teamId || programId || normalize(program);
        const key = `${stableTeamKey}__${normalize(team)}__${track}`;

        const weekend = String((r as any).weekend_date ?? "").trim();
        const sizeCandidate = meta.size;

        let arr = bucketToHist.get(key);
        if (!arr) {
          arr = [];
          bucketToHist.set(key, arr);
        }
        arr.push({ weekend, size: sizeCandidate });
      }

      const finalMap = new Map<string, Exclude<SizeOpt, "Any"> | null>();
      for (const [k, arr] of bucketToHist.entries()) {
        // already ordered desc from query, but sort defensively
        arr.sort((a, b) => (b.weekend || "").localeCompare(a.weekend || ""));
        finalMap.set(k, resolveTeamSize(arr));
      }

      setTeamFinalSizeMap(finalMap);
    }

    loadSizeHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  // 3) Load rows for display (server-side: weekend + level + server-side search)
  useEffect(() => {
    let cancelled = false;

    async function loadRows() {
      setLoading(true);
      setError(null);

      let q = supabase.from("v_results_normalized").select("*");

      // Weekend filter (optional)
      if (weekendDate !== ALL_WEEKENDS && weekendDate) {
        q = q.eq("weekend_date", weekendDate);
      } else {
        q = q.gte("weekend_date", SEASON_START);
      }

      // Level filter (optional)
      if (level !== "All") {
        q = q.ilike("division", `${level}%`);
      }

      // Server-side search
      const s = search.trim();
      if (s.length >= 2) {
        const esc = s.replace(/,/g, "");
        q = q.or(
          `team.ilike.%${esc}%,program.ilike.%${esc}%,division.ilike.%${esc}%,event_name.ilike.%${esc}%`
        );
      }

      q = q.order("weekend_date", { ascending: false });

      const { data, error } = await q;

      if (cancelled) return;

      if (error) {
        setError(error);
        setRows([]);
      } else {
        setRows(data ?? []);
      }

      setLoading(false);
    }

    loadRows();
    return () => {
      cancelled = true;
    };
  }, [weekendDate, level, search]);

  // 4) Derived display rows:
  // - apply row filters (age/d2/flex)
  // - apply Size filter using TEAM FINAL SIZE policy (not row-level)
  // - remove duplicate rows (one score per team per event)
  // - sort by Event Score desc
  const derived = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ageNorm = normalize(age);

    // 4a) row-level filter (not size)
    const filtered = rows.filter((r) => {
      const meta = parseMeta(r);

      // Age
      if (age !== "All") {
        const rowAge = String(r.age_bucket ?? "");
        if (rowAge) {
          if (normalize(rowAge) !== ageNorm) return false;
        } else {
          if (!normalize(meta.division).includes(ageNorm)) return false;
        }
      }

      // D2/Flex
      if (d2Mode === "D2Only" && !meta.isD2) return false;
      if (d2Mode === "NonD2Only" && meta.isD2) return false;

      if (flexMode === "FlexOnly" && !meta.isFlex) return false;
      if (flexMode === "NonFlexOnly" && meta.isFlex) return false;

      // Search fallback (when <2 chars or when server-side search not used)
      if (q) {
        const eventName = String(pick(r, eventNameKeys, "")).toLowerCase();
        const program = String(pick(r, programKeys, "")).toLowerCase();
        const team = String(pick(r, teamKeys, "")).toLowerCase();
        const div = meta.division.toLowerCase();
        if (!eventName.includes(q) && !program.includes(q) && !team.includes(q) && !div.includes(q)) return false;
      }

      return true;
    });

    // 4b) dedupe: one score per team per event
    // key = teamKey + compKey; keep max event_score
    const bestByTeamEvent = new Map<string, Row>();

    for (const r of filtered) {
      const program = String(pick(r, programKeys, "")).trim();
      const team = String(pick(r, teamKeys, "")).trim();
      if (!program || !team) continue;

      const meta = parseMeta(r);
      const track = buildTrackKey(meta);
      if (!track) continue;

      const teamId = String(r.team_id ?? "").trim();
      const programId = String(r.program_id ?? "").trim();
      const stableTeamKey = teamId || programId || normalize(program);

      // Team final size (season-wide), used ONLY for filtering + display bucket
      const sizeMapKey = `${stableTeamKey}__${normalize(team)}__${track}`;
      const finalSize = teamFinalSizeMap.get(sizeMapKey) ?? null;

      // ✅ apply Size filter at TEAM level
      if (size !== "Any") {
        if (!finalSize) continue;
        if (normalize(finalSize) !== normalize(size)) continue;
      }

      const weekend = String(pick(r, weekendKeys, "")).trim();
      const eventId = String(pick(r, eventIdKeys, "")).trim();
      const eventName = String(pick(r, eventNameKeys, "")).trim();
      const sourceUrl = String(pick(r, sourceUrlKeys, "")).trim();

      const compKey = eventId
        ? `event:${eventId}`
        : sourceUrl
          ? `url:${sourceUrl}`
          : `name:${eventName}__wk:${weekend}`;

      const teamKey = stableTeamKey ? String(stableTeamKey) : `${normalize(program)}__${normalize(team)}`;

      const key = `${teamKey}__${compKey}`;

      const score = toNum(pick(r, eventScoreKeys, "0"));
      const prev = bestByTeamEvent.get(key);
      if (!prev) {
        // attach computed bucket for display
        const bucket = finalSize ? `${track} ${finalSize}` : track;
        bestByTeamEvent.set(key, { ...r, __bucket: bucket });
      } else {
        const prevScore = toNum(pick(prev, eventScoreKeys, "0"));
        if (score > prevScore) {
          const bucket = finalSize ? `${track} ${finalSize}` : track;
          bestByTeamEvent.set(key, { ...r, __bucket: bucket });
        }
      }
    }

    const out = Array.from(bestByTeamEvent.values());

    // 4c) sort by Event Score DESC
    out.sort((a, b) => toNum(pick(b, eventScoreKeys, "0")) - toNum(pick(a, eventScoreKeys, "0")));

    return out;
  }, [rows, age, d2Mode, flexMode, size, search, teamFinalSizeMap]);

  const summary = useMemo(() => {
    const total = derived.length;
    const events = new Set(derived.map((r) => String(pick(r, eventNameKeys, "—")))).size;
    const weekends = new Set(derived.map((r) => String(pick(r, weekendKeys, "")))).size;
    return { total, events, weekends };
  }, [derived]);

  const weekendLabel = weekendDate === ALL_WEEKENDS ? "All Weekends (Season)" : weekendDate;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Results Explorer</h1>

      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Weekend: {weekendLabel} • Level: {level === "All" ? "All Levels" : level} • Age: {age} •{" "}
        {loading ? "Loading…" : `${summary.total} rows • ${summary.events} events • ${summary.weekends} weekends`}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 12,
          margin: "12px 0 18px",
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Weekend</span>
          <select
            value={weekendDate}
            onChange={(e) => setWeekendDate(e.target.value)}
            style={{ padding: "8px 10px", width: "100%", maxWidth: 220 }}
          >
            <option value={ALL_WEEKENDS}>All Weekends (Season)</option>
            {weekendOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Level</span>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as LevelOpt)}
            style={{ padding: "8px 10px", width: "100%", maxWidth: 200 }}
          >
            <option value="All">All Levels</option>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={`L${n}`}>{`L${n}`}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Age</span>
          <select
            value={age}
            onChange={(e) => setAge(e.target.value as AgeOpt)}
            style={{ padding: "8px 10px", width: "100%", maxWidth: 180 }}
          >
            {ageOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>D2</span>
          <select
            value={d2Mode}
            onChange={(e) => setD2Mode(e.target.value as D2Mode)}
            style={{ padding: "8px 10px", width: "100%", maxWidth: 140 }}
          >
            <option value="Any">Any</option>
            <option value="D2Only">D2 only</option>
            <option value="NonD2Only">Non-D2 only</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Flex</span>
          <select
            value={flexMode}
            onChange={(e) => setFlexMode(e.target.value as FlexMode)}
            style={{ padding: "8px 10px", width: "100%", maxWidth: 140 }}
          >
            <option value="Any">Any</option>
            <option value="FlexOnly">Flex only</option>
            <option value="NonFlexOnly">Non-Flex only</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Size</span>
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as SizeOpt)}
            style={{ padding: "8px 10px", width: "100%", maxWidth: 180 }}
          >
            <option value="Any">Any</option>
            <option value="X-Small">X-Small</option>
            <option value="Small">Small</option>
            <option value="Medium">Medium</option>
            <option value="Large">Large</option>
            <option value="X-Large">X-Large</option>
          </select>
        </label>

        <label style={{ gridColumn: "1 / span 4", display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Search (team / program / division / event)</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a team, program, division, event…"
            style={{ padding: "8px 10px" }}
          />
        </label>
      </div>

      {error && (
        <>
          <p style={{ color: "crimson" }}>Error:</p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </>
      )}

      {!loading && !error && derived.length === 0 && <p>No rows match your filters.</p>}

      {!loading && !error && derived.length > 0 && (
        <div style={{ overflowX: "auto", width: "100%", position: "relative" }}>
          <table
            cellPadding={8}
            style={{
              borderCollapse: "collapse",
              tableLayout: "fixed",
              width: "100%",
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                <th style={{ width: "10%" }}>Weekend</th>
                <th style={{ width: "34%" }}>Event</th>
                <th style={{ width: "24%" }}>Division</th>
                <th style={{ width: "16%" }}>Program</th>
                <th style={{ width: "16%" }}>Team</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap", width: "10%" }}>Event Score</th>
              </tr>
            </thead>
            <tbody>
              {derived.map((r) => (
                <tr key={`${String(r.team_id ?? r.team)}__${String(r.event_id ?? r.event_name)}__${String(r.weekend_date ?? "")}`}>
                  <td>{pick(r, weekendKeys, "")}</td>
                  <td style={clip}>{pick(r, eventNameKeys, "")}</td>
                  {/* ✅ show normalized bucket (track + final size when known; else track only) */}
                  <td style={clip}>{String(r.__bucket ?? pick(r, ["division"], ""))}</td>
                  <td style={clip}>{pick(r, programKeys, "")}</td>
                  <td style={{ ...clip, fontWeight: 600 }}>{pick(r, teamKeys, "")}</td>
                  <td style={{ textAlign: "right", fontWeight: 800 }}>{toNum(pick(r, eventScoreKeys, "0")).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}