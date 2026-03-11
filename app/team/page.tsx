"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type TeamHit = {
  team_id: string;
  program_id: string | null;
  team: string;
  program: string;
  team_display_name: string;
  event_count?: number;
  first_event_date?: string | null;
  last_event_date?: string | null;
};

export default function TeamSearchPage() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TeamHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const q = query.trim();
  const lastUpdated = new Date().toLocaleDateString();

  useEffect(() => {
    let cancelled = false;

    async function run() {
  setError(null);

  const search = q.trim();

  if (search.length < 3) {
    setHits([]);
    setLoading(false);
    return;
  }

  setLoading(true);

 const { data, error } = await supabase
  .from("mv_team_search_rebuilt")
  .select("team_id, program_id, team, program, event_count, first_event_date, last_event_date")
  .ilike("team", `%${search}%`)
  .order("team")
  .limit(100);

  if (cancelled) return;
      if (error) {
        setError(error);
        setHits([]);
        setLoading(false);
        return;
      }

      const map = new Map<string, TeamHit>();

      for (const r of data ?? []) {
        const teamId = String(r.team_id ?? "");
        if (!teamId) continue;

        const team = String(r.team ?? "");
        const program = String(r.program ?? "");
        const programId = (r.program_id ?? null) as string | null;
        const wd = (r.last_event_date ?? r.first_event_date ?? null) as string | null;

        const existing = map.get(teamId);

        if (!existing) {
          map.set(teamId, {
  team_id: teamId,
  program_id: (r.program_id as string | null) ?? null,
  team: String(r.team ?? ""),
  program: String(r.program ?? ""),
  team_display_name: `${String(r.team ?? "")} — ${String(r.program ?? "")}`,
  event_count: Number(r.event_count ?? 0),
  first_event_date: (r.first_event_date as string | null) ?? null,
  last_event_date: (r.last_event_date as string | null) ?? null,
});
        } else {
          existing.rows = (existing.rows ?? 0) + 1;

          if (wd) {
            if (!existing.first_week || wd < existing.first_week) {
              existing.first_week = wd;
            }
            if (!existing.last_week || wd > existing.last_week) {
              existing.last_week = wd;
            }
          }
        }
      }

      const list = Array.from(map.values()).sort((a, b) => {
        const ad = a.last_week ?? "";
        const bd = b.last_week ?? "";
        if (ad !== bd) return bd.localeCompare(ad);
        return (b.rows ?? 0) - (a.rows ?? 0);
      });

      setHits(list);
      setLoading(false);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [q]);

  const helperText = useMemo(() => {
    if (q.length < 2) return "Type at least 2 characters to search teams.";
    if (loading) return "Searching…";
    if (error) return "Search error (see details below).";
    return `${hits.length} unique team(s) found.`;
  }, [q.length, loading, error, hits.length]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
        Team Search
      </h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        <b>Where does your team Rank Nationally?</b>
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Scores sourced from Varsity competition results.
      </p>

      <p className="mt-1 text-xs text-slate-400">
        Updated: {lastUpdated}
      </p>

      <div style={{ display: "grid", gap: 8, maxWidth: 720, marginTop: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Team name</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., Lady Teal"
            style={{ padding: "10px 12px", fontSize: 16 }}
          />
        </label>

        <div style={{ opacity: 0.75 }}>{helperText}</div>

        {error && (
          <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(error, null, 2)}
          </pre>
        )}
      </div>

      <div style={{ marginTop: 18, maxWidth: 900 }}>
        {hits.map((h) => (
          <div
            key={h.team_id}
            style={{
              border: "1px solid #e6e6e6",
              borderRadius: 12,
              padding: 14,
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 16,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {h.team_display_name}
              </div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>
                Program: {h.program}
              </div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>
  Events: {h.event_count ?? 0} • Dates: {h.first_event_date ?? "—"} → {h.last_event_date ?? "—"}
</div>
            </div>

            <Link
              href={`/team/${h.team_id}`}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                textDecoration: "none",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              View Team →
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}