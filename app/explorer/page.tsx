"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Row = Record<string, any>;

function pick(row: Row, candidates: string[], fallback = "—") {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return fallback;
}

function toNum(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
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

  // ✅ Optional Level + Age
  const [level, setLevel] = useState<string>("All"); // "All" or "L1".."L6"
  const [age, setAge] = useState<string>("All"); // "All" or Tiny/Mini/Youth/Junior/Senior/U16/U18

  // Other filters
  const [d2Mode, setD2Mode] = useState<"Any" | "D2Only" | "NonD2Only">("Any");
  const [flexMode, setFlexMode] = useState<"Any" | "FlexOnly" | "NonFlexOnly">("Any");
  const [size, setSize] = useState<"Any" | "Small" | "Medium" | "Large" | "X-Small" | "X-Large">("Any");
  const [search, setSearch] = useState<string>("");
  const sortBy = "event_score" as const;
  
  const clip: React.CSSProperties = {
   whiteSpace: "nowrap",
   overflow: "hidden",
   textOverflow: "ellipsis",
  };

  // Column candidates
  const eventNameKeys = ["event_name", "event", "event_title", "competition_name", "competition", "event_display_name", "event_id"];
  const programKeys = ["program", "program_name", "gym", "gym_name"];
  const teamKeys = ["team", "team_name"];
  

  // Score candidates
  const eventScoreKeys = ["event_score", "event_total", "total_score", "score"];
  const rawScoreKeys = ["raw_score", "raw", "rawScore", "score_raw"];

  const ageOptions = ["All", "Tiny", "Mini", "Youth", "Junior", "Senior", "U16", "U18"];

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
      const options = (data ?? [])
        .map((r: any) => r.weekend_date)
        .filter(Boolean);

      setWeekendOptions(options);
    }

    loadWeekends();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Load rows (server-side filters: weekend + level + server-side search)
  useEffect(() => {
    let cancelled = false;

    async function loadRows() {
      setLoading(true);
      setError(null);

      let q = supabase
        .from("v_results_normalized")
        .select("*");

      // Weekend filter (optional)
      if (weekendDate !== ALL_WEEKENDS && weekendDate) {
        q = q.eq("weekend_date", weekendDate);
      }

      // Level filter (optional)
      if (level !== "All") {
        q = q.ilike("division", `${level}%`);
      }

      // ✅ Server-side search so you don't miss teams that aren't in the currently loaded slice
      const s = search.trim();
      if (s.length >= 2) {
        const esc = s.replace(/,/g, "");
        q = q.or(
          `team.ilike.%${esc}%,program.ilike.%${esc}%,division.ilike.%${esc}%,event_name.ilike.%${esc}%`
        );
      }

      // Safety caps
      // Fixed query limit (no UI control)
      const effectiveLimit =
        weekendDate === ALL_WEEKENDS && level === "All" ? 2000 : 1000;

      const { data, error } = await q.limit(Math.min(effectiveLimit, 20000));

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

  // Client-side filtering (age/d2/flex/size/round)
  const derived = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ageNorm = normalize(age);

    const out = rows.filter((r) => {
      const division = String(pick(r, ["division"], ""));

      // Age filter (use normalized column if present)
      const rowAge = String(r.age_bucket ?? "");
      if (age !== "All") {
        if (rowAge) {
          if (normalize(rowAge) !== ageNorm) return false;
        } else {
          if (!normalize(division).includes(ageNorm)) return false;
        }
      }

     

      // D2 / Flex (prefer normalized columns)
      const isD2 = Boolean(r.is_d2 ?? false);
      const isFlex = Boolean(r.is_flex ?? false);

      if (d2Mode === "D2Only" && !isD2) return false;
      if (d2Mode === "NonD2Only" && isD2) return false;

      if (flexMode === "FlexOnly" && !isFlex) return false;
      if (flexMode === "NonFlexOnly" && isFlex) return false;

      // Size filter (use size_effective)
      const sizeEff = String(r.size_effective ?? "");
      if (size !== "Any") {
        if (normalize(sizeEff) !== normalize(size)) return false;
      }

      // Search (still helps when user set search < 2 chars or no server-side search)
      if (q) {
        const eventName = String(pick(r, eventNameKeys, "")).toLowerCase();
        const program = String(pick(r, programKeys, "")).toLowerCase();
        const team = String(pick(r, teamKeys, "")).toLowerCase();
        const div = division.toLowerCase();
        if (!eventName.includes(q) && !program.includes(q) && !team.includes(q) && !div.includes(q)) {
          return false;
        }
      }

      return true;
    });

// Sorting
const scoreFor = (r: Row): number => {
  const n = (() => {
    switch (sortBy) {
      case "event_score":
        return toNum(pick(r, eventScoreKeys, undefined));


      default:
        return toNum(pick(r, rawScoreKeys, undefined));
    }
  })();

  return n ?? Number.NEGATIVE_INFINITY;
};

    return out.slice(0, 5000); // safety cap only
  }, [rows, age, d2Mode, flexMode, size, search]);

  const summary = useMemo(() => {
    const total = derived.length;
    const events = new Set(derived.map((r) => String(pick(r, eventNameKeys, "—")))).size;
    const weekends = new Set(derived.map((r) => String(r.weekend_date ?? ""))).size;
    return { total, events, weekends };
  }, [derived]);

  const weekendLabel = weekendDate === ALL_WEEKENDS ? "All Weekends" : (weekendDate || "(none)");
  const levelLabel = level === "All" ? "All Levels" : level;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>
        Results Explorer
      </h1>

      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Weekend: {weekendLabel} • Level: {levelLabel} • Age: {age} •{" "}
        {loading ? "Loading…" : `${summary.total} rows • ${summary.events} events • ${summary.weekends} weekends`}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12, margin: "12px 0 18px" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Weekend</span>
          <select
            value={weekendDate}
            onChange={(e) => setWeekendDate(e.target.value)}
            style={{ padding: "8px 10px", width: "100%", maxWidth: 220 }}
          >
            <option value={ALL_WEEKENDS}>All Weekends</option>
            {weekendOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Level</span>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            style={{ padding: "8px 10px", width: "100%", maxWidth: 200 }}
          >
            <option value="All">All Levels</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={`L${n}`}>{`L${n}`}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Age</span>
          <select
            value={age}
            onChange={(e) => setAge(e.target.value)}
            style={{ padding: "8px 10px", width: "100%", maxWidth: 180 }}
          >
            {ageOptions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>D2</span>
          <select
            value={d2Mode}
            onChange={(e) => setD2Mode(e.target.value as "Any" | "D2Only" | "NonD2Only")}
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
            onChange={(e) => setFlexMode(e.target.value as "Any" | "FlexOnly" | "NonFlexOnly")}
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
            onChange={(e) =>
              setSize(
                e.target.value as "Any" | "X-Small" | "Small" | "Medium" | "Large" | "X-Large"
               )
            }
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
                <th style={{ width: "30%" }}>Event</th>
                <th style={{ width: "22%" }}>Division</th>
                <th style={{ width: "12%" }}>Program</th>
                <th style={{ width: "14%" }}>Team</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap", width: "10%" }}>Event Score</th>
              </tr>
            </thead>
            <tbody>
              {derived.map((r, idx) => (
                <tr key={r.id}>
                  <td>{r.weekend_date}</td>
                  <td style={clip}>{r.event_name}</td>
                  <td style={clip}>{r.division}</td>
                  <td style={clip}>{r.program}</td>
                  <td style={{ ...clip, fontWeight: 600 }}>{r.team}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {Number(r.event_score)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
