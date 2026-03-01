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
  rows?: number;
  first_week?: string | null;
  last_week?: string | null;
};

export default function TeamSearchPage() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TeamHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const q = query.trim();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);

      if (q.length < 2) {
        setHits([]);
        return;
      }

      setLoading(true);

      // Pull a reasonable number of rows, then dedupe client-side by team_id.
      // (Supabase JS doesn't support group by nicely in the client.)
      const { data, error } = await supabase
        .from("v_results_normalized")
        .select("team_id, program_id, team, program, weekend_date")
        .ilike("team", `%${q}%`)
        .limit(5000);

      if (cancelled) return;

      if (error) {
        setError(error);
        setHits([]);
        setLoading(false);
        return;
      }

      const map = new Map<string, TeamHit>();

      for (const r of data ?? []) {
        const teamId = r.team_id as string;
        const team = (r.team ?? "") as string;
        const program = (r.program ?? "") as string;
        const programId = (r.program_id ?? null) as string | null;
        const wd = (r.weekend_date ?? null) as string | null;

        const existing = map.get(teamId);
        if (!existing) {
          map.set(teamId, {
            team_id: teamId,
            program_id: programId,
            team,
            program,
            team_display_name: `${team} — ${program}`,
            rows: 1,
            first_week: wd,
            last_week: wd,
          });
        } else {
          existing.rows = (existing.rows ?? 0) + 1;
          if (wd) {
            if (!existing.first_week || wd < existing.first_week) existing.first_week = wd;
            if (!existing.last_week || wd > existing.last_week) existing.last_week = wd;
          }
        }
      }

      // Sort: most recent activity first, then more rows
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
              <div style={{ fontWeight: 800, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {h.team_display_name}
              </div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>
                Team ID: {h.team_id}
              </div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>
                Weeks: {h.first_week ?? "—"} → {h.last_week ?? "—"} • Rows scanned: {h.rows ?? 0}
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
