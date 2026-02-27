"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BarRankingsChart } from "./BarRankingsChart";

type Row = Record<string, any>;
const CHART_LIMIT = 10;
const TABLE_LIMIT = 20;
function pick(row: Row, candidates: string[], fallback = "—") {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return fallback;
}
function keyify(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s']/g, "") // drop punctuation
    .replace(/\s+/g, " ");
}

function cleanLabel(s: any) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}
function toNum(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// Remove size suffix from division text since size_effective is its own descriptor
function divisionCore(div: string) {
  const s = String(div ?? "").trim().replace(/\s+/g, " ");
  // core = everything before descriptors like "- Flex - D2 - Small"
  return s.split(" - ")[0].trim();
}

type RankingRow = {
  rank: number;
  division_core: string;
  is_flex: boolean;
  is_d2: boolean;
  size_effective: string;

  program: string;
  team_name: string;

  events_count: number;
  avg_score: number;
  last_weekend_date: string | null;
};
function RankingsBarChart({ data }: { data: { team_name: string; avg_score: number }[] }) {
  if (!data?.length) return null;

  // Chart sizing
  const width = 1100;
  const height = 340;
  const padding = { top: 20, right: 20, bottom: 110, left: 60 };

  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const scores = data.map((d) => d.avg_score);
  const max = Math.max(...scores);
  const min = Math.min(...scores);

  // Give a little headroom + floor so bars don’t look identical
  const yMax = Math.ceil((max + 0.05) * 10) / 10;
  const yMin = Math.floor((min - 0.05) * 10) / 10;

  const xStep = innerW / data.length;
  const barW = Math.max(6, xStep * 0.72);

  const y = (v: number) => {
    const t = (v - yMin) / Math.max(0.0001, (yMax - yMin));
    return padding.top + (1 - t) * innerH;
  };

  const baselineY = y(yMin);

  // Grid lines (5)
  const gridLines = 5;
  const grid = Array.from({ length: gridLines + 1 }, (_, i) => {
    const v = yMin + ((yMax - yMin) * i) / gridLines;
    return { v: Number(v.toFixed(2)), y: y(v) };
  });

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginTop: 14 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Top {data.length} — Average Event Score</div>

      <div style={{ overflowX: "auto" }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* grid */}
          {grid.map((g, idx) => (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={g.y}
                x2={width - padding.right}
                y2={g.y}
                stroke="#eee"
              />
              <text x={padding.left - 10} y={g.y + 4} fontSize="11" textAnchor="end" fill="#666">
                {g.v}
              </text>
            </g>
          ))}

          {/* axis */}
          <line
            x1={padding.left}
            y1={baselineY}
            x2={width - padding.right}
            y2={baselineY}
            stroke="#bbb"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke="#bbb"
          />

          {/* bars */}
          {data.map((d, i) => {
            const xCenter = padding.left + i * xStep + xStep / 2;
            const x = xCenter - barW / 2;
            const yTop = y(d.avg_score);
            const h = Math.max(0, baselineY - yTop);

            return (
              <g key={i}>
                <rect x={x} y={yTop} width={barW} height={h} rx={4} ry={4} fill="#111" opacity={0.85} />
                {/* value label */}
                <text x={xCenter} y={yTop - 6} fontSize="11" textAnchor="middle" fill="#111">
                  {d.avg_score.toFixed(3)}
                </text>
                {/* rotated team label */}
                <text
                  x={xCenter}
                  y={height - padding.bottom + 12}
                  fontSize="11"
                  textAnchor="end"
                  fill="#333"
                  transform={`rotate(-55 ${xCenter} ${height - padding.bottom + 12})`}
                >
                  {d.team_name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
type LinePoint = { date: string; score: number };
type TeamSeries = { label: string; points: LinePoint[] };

function hashToHue(str: string) {
  // deterministic “unique color” from a string
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

function LineRankingsChart({ series }: { series: TeamSeries[] }) {
  if (!series?.length) return null;

  const width = 1100;
  const height = 360;
  const pad = { top: 18, right: 220, bottom: 55, left: 60 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  // Gather all points
  const all = series.flatMap((s) =>
    s.points
      .map((p) => ({ ...p, t: Date.parse(p.date) }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.score))
  );

  if (!all.length) return null;

  const tMin = Math.min(...all.map((p) => p.t));
  const tMax = Math.max(...all.map((p) => p.t));
  const yMinRaw = Math.min(...all.map((p) => p.score));
  const yMaxRaw = Math.max(...all.map((p) => p.score));

  // add padding to y range so it’s readable
  const yMin = Math.floor((yMinRaw - 0.2) * 10) / 10;
  const yMax = Math.ceil((yMaxRaw + 0.2) * 10) / 10;

  const x = (t: number) => {
    const frac = (t - tMin) / Math.max(1, tMax - tMin);
    return pad.left + frac * innerW;
  };

  const y = (v: number) => {
    const frac = (v - yMin) / Math.max(0.0001, yMax - yMin);
    return pad.top + (1 - frac) * innerH;
  };

  const gridLines = 5;
  const yGrid = Array.from({ length: gridLines + 1 }, (_, i) => {
    const v = yMin + ((yMax - yMin) * i) / gridLines;
    return { v: Number(v.toFixed(2)), y: y(v) };
  });

  // x ticks: up to 6 evenly spaced
  const xTicks = 6;
  const xGrid = Array.from({ length: xTicks }, (_, i) => {
    const t = tMin + ((tMax - tMin) * i) / Math.max(1, xTicks - 1);
    const d = new Date(t);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { t, x: x(t), label };
  });

  const pathFor = (pts: { t: number; score: number }[]) => {
    const sorted = [...pts].sort((a, b) => a.t - b.t);
    if (!sorted.length) return "";
    return sorted
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t).toFixed(2)} ${y(p.score).toFixed(2)}`)
      .join(" ");
  };

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginTop: 14 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>
        Top {series.length} — Event Score Over Time
      </div>
      <div style={{ opacity: 0.75, fontSize: 13, marginBottom: 10 }}>
        X = weekend date • Y = event_score • one line per team (best per event; rounds ignored)
      </div>

      <div style={{ overflowX: "auto" }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Y grid */}
          {yGrid.map((g, idx) => (
            <g key={idx}>
              <line x1={pad.left} y1={g.y} x2={width - pad.right} y2={g.y} stroke="#eee" />
              <text x={pad.left - 10} y={g.y + 4} fontSize="11" textAnchor="end" fill="#666">
                {g.v}
              </text>
            </g>
          ))}

          {/* X ticks */}
          {xGrid.map((g, idx) => (
            <g key={idx}>
              <line x1={g.x} y1={pad.top} x2={g.x} y2={height - pad.bottom} stroke="#f2f2f2" />
              <text x={g.x} y={height - pad.bottom + 18} fontSize="11" textAnchor="middle" fill="#666">
                {g.label}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} stroke="#bbb" />
          <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke="#bbb" />

          {/* Lines + points */}
          {series.map((s) => {
            const hue = hashToHue(s.label);
            const color = `hsl(${hue} 70% 45%)`;

            const pts = s.points
              .map((p) => ({ t: Date.parse(p.date), score: p.score }))
              .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.score));

            const d = pathFor(pts);

            return (
              <g key={s.label}>
                <path d={d} fill="none" stroke={color} strokeWidth={2} opacity={0.95} />
                {pts.map((p, i) => (
                  <circle key={i} cx={x(p.t)} cy={y(p.score)} r={3} fill={color} />
                ))}
              </g>
            );
          })}

          {/* Legend */}
          <g>
            {series.map((s, i) => {
              const hue = hashToHue(s.label);
              const color = `hsl(${hue} 70% 45%)`;
              const lx = width - pad.right + 18;
              const ly = pad.top + 14 + i * 18;

              return (
                <g key={s.label}>
                  <line x1={lx} y1={ly} x2={lx + 18} y2={ly} stroke={color} strokeWidth={3} />
                  <text x={lx + 24} y={ly + 4} fontSize="12" fill="#e8e8e8">
  {s.label.length > 32 ? s.label.slice(0, 32) + "…" : s.label}
</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
export default function RankingsPage() {
  const DISPLAY_LIMIT = 15;
  const clearFilters = () => {
    setLevel("L3");              // match your default
    setAge("Junior");            // match your default
    setD2Mode("Any");            // match your default
    setFlexMode("Any");          // match your default
    setSize("Any");              // match your default
    setIncludeOneComp(false);    // or true, whatever default is
    setQuery("");                // your search input state
  };
  // Data
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Weekends (kept internally; UI hidden; always ALL)
  const [weekendOptions, setWeekendOptions] = useState<string[]>([]);
  const ALL_WEEKENDS = "__ALL__";
  const [weekendDate] = useState<string>(ALL_WEEKENDS);

  // Filters (kept)
  const [level, setLevel] = useState<string>("L3"); // default L3
  const [age, setAge] = useState<string>("Junior"); // default Junior
  const [d2Mode, setD2Mode] = useState<"Any" | "D2Only" | "NonD2Only">("Any");
  const [flexMode, setFlexMode] = useState<"Any" | "FlexOnly" | "NonFlexOnly">("Any");
  const [size, setSize] = useState<"Any" | "Small" | "Medium" | "Large" | "X-Small" | "X-Large">("Any");
  const [search, setSearch] = useState<string>("");

  // ✅ Toggle: include teams with only 1 comp
  const [includeOneComp, setIncludeOneComp] = useState<boolean>(false);
  const minEvents = includeOneComp ? 1 : 2;

  const eventNameKeys = [
    "event_name",
    "event",
    "event_title",
    "competition_name",
    "competition",
    "event_display_name",
    "event_id",
  ];
  const programKeys = ["program", "program_name", "gym", "gym_name"];
  const teamKeys = ["team", "team_name"];

  const ageOptions = ["All", "Tiny", "Mini", "Youth", "Junior", "Senior", "U16", "U18"];

  // 1) Load weekends (not shown, but harmless to keep)
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

  // 2) Load rows (server-side filters: weekend (always ALL), level, server-side search)
  useEffect(() => {
    let cancelled = false;

    async function loadRows() {
  setLoading(true);
  setError(null);

  let q = supabase.from("v_results_normalized").select("*");

  // ✅ Server-side filters (prevents missing teams due to arbitrary LIMIT slices)

  // Weekend filter (kept, UI hidden; normally ALL)
  if (weekendDate !== ALL_WEEKENDS && weekendDate) {
    q = q.eq("weekend_date", weekendDate);
  }

  // Level filter (optional)
  if (level !== "All") {
    q = q.ilike("division", `${level}%`);
  }

  // Age filter (Rankings: trust division text)
  if (age !== "All") {
    q = q.ilike("division", `%${age}%`);
  }

  // D2 / Flex
  if (d2Mode === "D2Only") q = q.eq("is_d2", true);
  if (d2Mode === "NonD2Only") q = q.eq("is_d2", false);

  if (flexMode === "FlexOnly") q = q.eq("is_flex", true);
  if (flexMode === "NonFlexOnly") q = q.eq("is_flex", false);

  

  // Server-side search (keeps things snappy and correct)
  const s = search.trim();
  if (s.length >= 2) {
    const esc = s.replace(/,/g, "");
    q = q.or(
      `team.ilike.%${esc}%,program.ilike.%${esc}%,division.ilike.%${esc}%,event_name.ilike.%${esc}%`
    );
  }

  // ✅ Deterministic order + bigger range so we don’t miss rows
  q = q.order("weekend_date", { ascending: false });

  const { data, error } = await q.range(0, 49999);

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

  // 3) Client-side filtering (age/d2/flex/size/search)
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ageNorm = normalize(age);

    return rows.filter((r) => {
  const division = String(pick(r, ["division"], ""));

  // ✅ Age filter (trust division text)
  if (age !== "All") {
    if (!normalize(division).includes(ageNorm)) return false;
  }

  // Search
  if (q) {
    const eventName = String(pick(r, eventNameKeys, "")).toLowerCase();
    const program = String(pick(r, programKeys, "")).toLowerCase();
    const team = String(pick(r, teamKeys, "")).toLowerCase();
    const div = division.toLowerCase();
    if (
      !eventName.includes(q) &&
      !program.includes(q) &&
      !team.includes(q) &&
      !div.includes(q)
    ) {
      return false;
    }
  }

  return true;
});
  }, [rows, age, d2Mode, flexMode, size, search]);

const rankings = useMemo<RankingRow[]>(() => {
  type EventAgg = { maxScore: number; weekend: string | null };

  type TeamAgg = {
    division_core: string;

    // keep “team identity”
    program: string;
    team_name: string;

    // normalized keys used for grouping
    program_key: string;
    team_key: string;

    // IMPORTANT: these can vary per-row; we’ll compute a team-level “mode”
    flex_true: number;
    flex_false: number;
    d2_true: number;
    d2_false: number;

    // size_effective can vary; keep counts per size and pick most common
    size_counts: Map<string, number>;

    events: Map<string, EventAgg>;
  };

  const map = new Map<string, TeamAgg>();

  for (const r of filteredRows) {
    const division = String(r.division ?? "");
    const division_core = divisionCore(division);

    const isD2 = Boolean(r.is_d2 ?? false);
    const isFlex = Boolean(r.is_flex ?? false);
    const size_effective = String(r.size_effective ?? "");

    const programRaw = pick(r, programKeys, "");
    const teamRaw = pick(r, teamKeys, "");

    const program = cleanLabel(programRaw);
    const team_name = cleanLabel(teamRaw);

    const program_key = r.program_id ? String(r.program_id) : keyify(programRaw);
    const team_key = r.team_id ? String(r.team_id) : keyify(teamRaw);

    const event_id = String(r.event_id ?? pick(r, ["event_id"], ""));
    const score = toNum(r.event_score);
    if (!event_id || score === null) continue;

    const weekend = (r.weekend_date ?? null) ? String(r.weekend_date) : null;

    // Group by division_core + identity keys
    const key = `${division_core}|${program_key}|${team_key}`;

    let agg = map.get(key);
    if (!agg) {
      agg = {
        division_core,
        program,
        team_name,
        program_key,
        team_key,
        flex_true: 0,
        flex_false: 0,
        d2_true: 0,
        d2_false: 0,
        size_counts: new Map<string, number>(),
        events: new Map<string, EventAgg>(),
      };
      map.set(key, agg);
    }

    // track flex/d2 counts (to compute a stable team-level value)
    if (isFlex) agg.flex_true++;
    else agg.flex_false++;

    if (isD2) agg.d2_true++;
    else agg.d2_false++;

    // track size counts
    if (size_effective) {
      agg.size_counts.set(size_effective, (agg.size_counts.get(size_effective) ?? 0) + 1);
    }

    // dedupe rounds: keep highest event_score per event
    const existing = agg.events.get(event_id);
    if (!existing || score > existing.maxScore) {
      agg.events.set(event_id, { maxScore: score, weekend });
    }
  }

  // Convert to rows
  const aggregatedTeams = Array.from(map.values()).map((agg) => {
    const eventScores = Array.from(agg.events.values()).map((e) => e.maxScore);
    const events_count = eventScores.length;

    const avg_score =
      events_count > 0 ? eventScores.reduce((a, b) => a + b, 0) / events_count : 0;

    const last_weekend_date =
      Array.from(agg.events.values())
        .map((e) => e.weekend)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] ?? null;

    // choose team-level flex/d2 by majority (mode)
    const is_flex = agg.flex_true >= agg.flex_false;
    const is_d2 = agg.d2_true >= agg.d2_false;

    // choose team-level size_effective by most common value
    let size_effective = "—";
    let best = -1;
    for (const [k, v] of agg.size_counts.entries()) {
      if (v > best) {
        best = v;
        size_effective = k;
      }
    }

    return {
      rank: 0,
      division_core: agg.division_core,
      is_flex,
      is_d2,
      size_effective,

      program: agg.program,
      team_name: agg.team_name,

      events_count,
      avg_score: Number(avg_score.toFixed(3)),
      last_weekend_date,
    } as RankingRow;
  });

  // ✅ APPLY D2/FLEX/SIZE FILTERS AT TEAM LEVEL (not row level)
  const minEvents = includeOneComp ? 1 : 2;

  const out = aggregatedTeams
    .filter((t) => {
      if (d2Mode === "D2Only" && !t.is_d2) return false;
      if (d2Mode === "NonD2Only" && t.is_d2) return false;

      if (flexMode === "FlexOnly" && !t.is_flex) return false;
      if (flexMode === "NonFlexOnly" && t.is_flex) return false;

      if (size !== "Any" && normalize(t.size_effective) !== normalize(size)) return false;

      return true;
    })
    .filter((t) => t.events_count >= minEvents)
    .sort((a, b) => b.avg_score - a.avg_score);

  // assign rank
  out.forEach((r, i) => (r.rank = i + 1));

  // top 25
  return out.slice(0, TABLE_LIMIT);
}, [filteredRows, d2Mode, flexMode, size, includeOneComp]);
const topSeries = useMemo<TeamSeries[]>(() => {
  const top = rankings.slice(0, CHART_LIMIT);

  const topKeys = new Set(
    top.map((r) => `${keyify(r.program)}|${keyify(r.team_name)}`)
  );

  const byTeam = new Map<string, Map<string, { date: string; score: number }>>();

  for (const r of filteredRows) {
    const program = cleanLabel(pick(r, ["program", "program_name", "gym", "gym_name"], ""));
    const team = cleanLabel(pick(r, ["team", "team_name"], ""));
    const teamKey = `${keyify(program)}|${keyify(team)}`;

    if (!topKeys.has(teamKey)) continue;

    const event_id = String(r.event_id ?? "");
    const date = String(r.weekend_date ?? "");
    const score = toNum(r.event_score);
    if (!event_id || !date || score === null) continue;

    if (!byTeam.has(teamKey)) byTeam.set(teamKey, new Map());
    const m = byTeam.get(teamKey)!;

    const existing = m.get(event_id);
    if (!existing || score > existing.score) {
      m.set(event_id, { date, score });
    }
  }

  return top.map((r) => {
    const label = `${r.program} — ${r.team_name}`;
    const teamKey = `${keyify(r.program)}|${keyify(r.team_name)}`;

    const points = byTeam.get(teamKey)
      ? Array.from(byTeam.get(teamKey)!.values())
          .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
          .map((p) => ({ date: p.date, score: p.score }))
      : [];

    return { label, points };
  });
}, [rankings, filteredRows]);
  const summary = useMemo(() => {
    const totalTeams = rankings.length;
    const events = new Set(filteredRows.map((r) => String(pick(r, eventNameKeys, "—")))).size;
    const weekends = new Set(filteredRows.map((r) => String(r.weekend_date ?? ""))).size;
    return { totalTeams, events, weekends };
  }, [rankings, filteredRows]);

  const levelLabel = level === "All" ? "All Levels" : level;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Rankings</h1>

      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Sorted by <b>Average Event Score</b> (event_score only; rounds ignored). Showing top {DISPLAY_LIMIT}. • Level: {levelLabel} • Age: {age} •{" "}
        {loading ? "Loading…" : `${summary.totalTeams} teams (from ${summary.events} events across ${summary.weekends} weekends)`}
      </p>

      {/* Controls (Weekend / Round / Min Events / Limit hidden) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12, margin: "12px 0 18px" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Level</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)} style={{ padding: "8px 10px" }}>
            <option value="All">All Levels</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={`L${n}`}>{`L${n}`}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Age</span>
          <select value={age} onChange={(e) => setAge(e.target.value)} style={{ padding: "8px 10px" }}>
            {ageOptions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>D2</span>
          <select value={d2Mode} onChange={(e) => setD2Mode(e.target.value as any)} style={{ padding: "8px 10px" }}>
            <option value="Any">Any</option>
            <option value="D2Only">D2 only</option>
            <option value="NonD2Only">Non-D2 only</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Flex</span>
          <select value={flexMode} onChange={(e) => setFlexMode(e.target.value as any)} style={{ padding: "8px 10px" }}>
            <option value="Any">Any</option>
            <option value="FlexOnly">Flex only</option>
            <option value="NonFlexOnly">Non-Flex only</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Size</span>
          <select value={size} onChange={(e) => setSize(e.target.value as any)} style={{ padding: "8px 10px" }}>
            <option value="Any">Any</option>
            <option value="X-Small">X-Small</option>
            <option value="Small">Small</option>
            <option value="Medium">Medium</option>
            <option value="Large">Large</option>
            <option value="X-Large">X-Large</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Include 1-comp teams</span>
          <select
            value={includeOneComp ? "yes" : "no"}
            onChange={(e) => setIncludeOneComp(e.target.value === "yes")}
            style={{ padding: "8px 10px" }}
          >
            <option value="no">No (2+ comps)</option>
            <option value="yes">Yes (include 1 comp)</option>
          </select>
        </label>

        <label style={{ gridColumn: "1 / span 6", display: "grid", gap: 6 }}>
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

      {!loading && !error && rankings.length === 0 && (
        <p>No teams match your filters. Try turning on “Include 1-comp teams”.</p>
      )}

      {!loading && !error && rankings.length > 0 && (
  <>
    <BarRankingsChart rankings={rankings.slice(0, 10)} />

    <div style={{ overflowX: "auto", marginTop: 20 }}>
      <table cellPadding={10} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
            <th>Rank</th>
            <th>Program</th>
            <th>Team</th>
            <th>Events</th>
            <th>Average Event Score</th>
            <th>Last weekend</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((r, idx) => (
            <tr key={`${idx}`} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ fontWeight: 900 }}>{r.rank}</td>
              <td>{r.program}</td>
              <td style={{ fontWeight: 900 }}>{r.team_name}</td>
              <td>{r.events_count}</td>
              <td style={{ fontWeight: 900 }}>{r.avg_score}</td>
              <td>{r.last_weekend_date ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
)}
    </main>
  );
}