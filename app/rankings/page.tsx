"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BarRankingsChart } from "./BarRankingsChart";



type NormRow = {
  weekend_date: string | null;
  division: string | null;
  program: string | null;
  team: string | null;
  event_score: number | string | null;
};

type RankedTeam = {
  key: string;
  division: string;
  program: string;
  team: string;
  events: number;
  avg_event_score: number;
  last_weekend: string | null;
};

function toNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt3(v: number): string {
  return v.toFixed(3);
}

function safeStr(v: any): string {
  return (v ?? "").toString();
}

function cmpDesc(a: number, b: number) {
  return b - a;
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [wrapW, setWrapW] = useState<number>(900);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 900;
      setWrapW(Math.max(320, Math.floor(w)));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isMobile = wrapW < 640;

  // internal drawing size (viewBox)
  const W = 1000;
  const H = isMobile ? 520 : 360;

  const pad = isMobile
    ? { top: 18, right: 16, bottom: 40, left: 150 }
    : { top: 18, right: 30, bottom: 40, left: 260 };

  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.001, max - min);

  const barH = innerH / Math.max(1, data.length);
  const barInnerH = Math.max(isMobile ? 16 : 12, barH * 0.7);

  const x = (v: number) => ((v - min) / span) * innerW;

  const clipStyle: React.CSSProperties = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ fontWeight: 750, marginBottom: 8 }}>Top 10 Teams (Avg Event Score)</div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* x-axis baseline */}
        <line
          x1={pad.left}
          x2={pad.left + innerW}
          y1={pad.top + innerH}
          y2={pad.top + innerH}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1}
        />

        {/* bars */}
        {data.map((d, i) => {
          const y = pad.top + i * barH + (barH - barInnerH) / 2;
          const w = x(d.value);

          return (
            <g key={d.label + i}>
              {/* label */}
              <foreignObject
                x={12}
                y={y}
                width={pad.left - 18}
                height={barInnerH}
              >
                <div
                  style={{
                    ...clipStyle,
                    fontSize: isMobile ? 12 : 13,
                    lineHeight: `${barInnerH}px`,
                    color: "rgba(255,255,255,0.9)",
                  }}
                  title={d.label}
                >
                  {d.label}
                </div>
              </foreignObject>

              {/* bar */}
              <rect
                x={pad.left}
                y={y}
                width={Math.max(2, w)}
                height={barInnerH}
                rx={8}
                ry={8}
                fill="rgba(45, 212, 191, 0.55)" // teal-ish, consistent with your theme
              />

              {/* value */}
              <text
                x={pad.left + w + 8}
                y={y + barInnerH * 0.72}
                fill="rgba(255,255,255,0.85)"
                fontSize={isMobile ? 12 : 13}
              >
                {fmt3(d.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function RankingsPage() {
  const [loading, setLoading] = useState(true);
  const [rawRows, setRawRows] = useState<NormRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // MVP default guardrail: avoid tiny-sample noise
  const minEvents = 1;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // No filters: just grab a large slice of normalized results
        const { data, error } = await supabase
          .from("v_results_normalized")
          .select("weekend_date, division, program, team, event_score")
          .order("weekend_date", { ascending: false })
          .range(0, 49999);

        if (cancelled) return;

        if (error) {
          setErrorMsg(error.message);
          setRawRows([]);
          return;
        }

        setRawRows((data ?? []) as NormRow[]);
      } catch (e: any) {
        if (!cancelled) {
          setErrorMsg(e?.message ?? "Unknown error");
          setRawRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const ranked = useMemo<RankedTeam[]>(() => {
    // Aggregate by (division+program+team)
    const map = new Map<
      string,
      { division: string; program: string; team: string; sum: number; ct: number; last: string | null }
    >();

    for (const r of rawRows) {
      const division = safeStr(r.division).trim();
      const program = safeStr(r.program).trim();
      const team = safeStr(r.team).trim();

      if (!division || !program || !team) continue;

      const score = toNum(r.event_score);
      if (score === null) continue;

      const key = `${division}|||${program}|||${team}`;
      const cur = map.get(key);

      const wk = r.weekend_date ?? null;
      if (!cur) {
        map.set(key, { division, program, team, sum: score, ct: 1, last: wk });
      } else {
        cur.sum += score;
        cur.ct += 1;

        // keep most recent weekend (strings sort fine if ISO dates)
        if (!cur.last || (wk && wk > cur.last)) cur.last = wk;
      }
    }

    const out: RankedTeam[] = [];
    for (const [key, v] of map.entries()) {
      if (v.ct < minEvents) continue;

      out.push({
        key,
        division: v.division,
        program: v.program,
        team: v.team,
        events: v.ct,
        avg_event_score: v.sum / v.ct,
        last_weekend: v.last,
      });
    }

    out.sort((a, b) => cmpDesc(a.avg_event_score, b.avg_event_score));
    return out;
  }, [rawRows]);

  const top10 = useMemo(() => {
    return ranked.slice(0, 10).map((r) => ({
      label: `${r.team}`,
      value: r.avg_event_score,
    }));
  }, [ranked]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, margin: 0 }}>
          Rankings
        </h1>
        <div style={{ color: "rgba(255,255,255,0.75)", marginTop: 6 }}>
          No filters (MVP): Top teams by average Event Score (min {minEvents} events).
        </div>
      </div>

      {errorMsg ? (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,0,0,0.08)",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 750, marginBottom: 6 }}>Error</div>
          <div style={{ opacity: 0.9 }}>{errorMsg}</div>
        </div>
      ) : null}

      {loading ? (
        <div style={{ opacity: 0.85 }}>Loading rankings…</div>
      ) : ranked.length === 0 ? (
        <div style={{ opacity: 0.85 }}>
          No teams found (min events = {minEvents}). If you expect results, try temporarily setting minEvents to 1 in code.
        </div>
      ) : (
        <>
          <BarChart data={top10} />

          <div
            style={{
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 12,
              padding: 12,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ fontWeight: 750, marginBottom: 10 }}>
              Top 50
            </div>

            <div style={{ overflowX: "auto" }}>
              <table
                cellPadding={10}
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                }}
              >
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
                    <th style={{ width: "8%", whiteSpace: "nowrap" }}>Rank</th>
                    <th style={{ width: "18%" }}>Division</th>
                    <th style={{ width: "18%" }}>Program</th>
                    <th style={{ width: "26%" }}>Team</th>
                    <th style={{ width: "10%", textAlign: "right", whiteSpace: "nowrap" }}>Events</th>
                    <th style={{ width: "20%", textAlign: "right", whiteSpace: "nowrap" }}>Avg Event</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.slice(0, 50).map((r, idx) => (
                    <tr key={r.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <td style={{ whiteSpace: "nowrap" }}>{idx + 1}</td>
                      <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.division}>
                        {r.division}
                      </td>
                      <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.program}>
                        {r.program}
                      </td>
                      <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 650 }} title={r.team}>
                        {r.team}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{r.events}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap", fontWeight: 800 }}>
                        {fmt3(r.avg_event_score)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
              Source: v_results_normalized (latest 50k rows), grouped by division+program+team.
            </div>
          </div>
        </>
      )}
    </div>
  );
}