"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { trackUserEvent } from "@/lib/user-events";

type TeamHit = {
  team_id: string;
  program_id: string | null;
  team: string;
  program: string;
  event_count?: number | null;
  first_event_date?: string | null;
  last_event_date?: string | null;
  rows?: number;
  first_week?: string | null;
  last_week?: string | null;
};

export default function TeamSearchPage() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TeamHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<any>(null);

  const [session, setSession] = useState<any>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  const q = query.trim();

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);

      if (!session?.user) return;

      const { data } = await supabase
        .from("user_followed_teams")
        .select("team_id")
        .eq("user_id", session.user.id);

      if (data) {
        setFollowedIds(new Set(data.map((d) => d.team_id)));
      }
    }

    loadSession();
  }, []);

  useEffect(() => {
    trackUserEvent({
      eventType: "team_search_view",
      page: "/team",
    });
  }, []);

  async function runSearch() {
  setError(null);
  setHasSearched(true);

  const search = q.trim();

  if (search.length < 4) {
    setHits([]);
    setLoading(false);
    return;
  }

  setLoading(true);

  try {
    const safeSearch = search
      .replaceAll("%", "\\%")
      .replaceAll("_", "\\_");

    const { data, error } = await supabase
      .from("mv_team_search_lookup")
      .select(`
        team_id,
        program_id,
        team,
        program,
        event_count,
        first_event_date,
        last_event_date
      `)
      .ilike("search_text", `%${safeSearch}%`)
      .order("last_event_date", { ascending: false })
      .limit(50);

    if (error) {
      const message = String(error.message ?? "");

      if (
        message.includes("AbortError") ||
        message.includes("aborted") ||
        message.includes("Lock was stolen by another request")
      ) {
        setLoading(false);
        return;
      }

      setError(error);
      setHits([]);
      setLoading(false);
      return;
    }

    const list: TeamHit[] = (data ?? []).map((row) => ({
      team_id: String(row.team_id),
      program_id: row.program_id ?? null,
      team: String(row.team ?? ""),
      program: String(row.program ?? ""),
      event_count: Number(row.event_count ?? 0),
      first_event_date: row.first_event_date ?? null,
      last_event_date: row.last_event_date ?? null,
      first_week: row.first_event_date ?? null,
      last_week: row.last_event_date ?? null,
      rows: Number(row.event_count ?? 0),
    }));

    setHits(list);
    setLoading(false);

    void trackUserEvent({
      eventType: "team_search_submit",
      page: "/team",
      metadata: {
        search_term: search,
        result_count: list.length,
      },
    });

    if (typeof window !== "undefined" && (window as any).fbq) {
      (window as any).fbq("track", "Search", {
        search_string: search,
      });
    }
  } catch (err) {
    setError({
      message: err instanceof Error ? err.message : String(err),
    });
    setHits([]);
    setLoading(false);
  }
}
  async function toggleFollow(teamId: string, teamName: string) {
    if (!session?.user) {
      window.location.href = `/login?next=/team`;
      return;
    }

    const isFollowing = followedIds.has(teamId);

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("user_followed_teams")
          .delete()
          .eq("user_id", session.user.id)
          .eq("team_id", teamId);

        if (error) {
          console.error("Unfollow error:", error);
          alert(error.message || "Failed to unfollow team.");
          return;
        }

        setFollowedIds((prev) => {
          const next = new Set(prev);
          next.delete(teamId);
          return next;
        });
      } else {
        const { error } = await supabase
          .from("user_followed_teams")
          .insert({
            user_id: session.user.id,
            team_id: teamId,
          });

        if (error) {
          console.error("Follow error:", error);
          alert(error.message || "Failed to follow team.");
          return;
        }

        setFollowedIds((prev) => {
          const next = new Set(prev);
          next.add(teamId);
          return next;
        });

        void trackUserEvent({
          eventType: "team_followed",
          page: "/team",
          teamId,
          metadata: {
            team_name: teamName,
          },
        });
      }
    } catch (err) {
      console.error("Toggle follow failed:", err);
      alert("Something went wrong. Please try again.");
    }
  }

  const helperText = useMemo(() => {
    if (!hasSearched) return "Type at least 4 characters, then click Search.";
    if (q.length < 4) return "Type at least 4 characters to search teams.";
    if (loading) return "Searching…";
    if (error) return "Search error (see details below).";
    return `${hits.length} unique team(s) found.`;
  }, [hasSearched, q.length, loading, error, hits.length]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
        Team Search
      </h1>

      <p style={{ marginTop: 0, opacity: 0.75 }}>
        <b>Track your team! ANY Team!</b>
      </p>

      <p className="mt-1 text-xs text-slate-400">
        Scores sourced from Varsity competition results.
      </p>

      <div style={{ display: "grid", gap: 8, maxWidth: 720, marginTop: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 650 }}>Team name</span>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  runSearch();
                }
              }}
              placeholder="e.g., Lady Teal"
              style={{ padding: "10px 12px", fontSize: 16, flex: 1 }}
            />

            <button
              type="button"
              onClick={runSearch}
              disabled={loading}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #14b8a6",
                background: "rgba(20,184,166,0.12)",
                color: "#14b8a6",
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
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
                {`${h.program} ${h.team}`}
              </div>

              <div style={{ opacity: 0.75, fontSize: 13 }}>
                Program: {h.program}
              </div>

              <div style={{ opacity: 0.75, fontSize: 13 }}>
                Events: {h.event_count ?? 0} • Weekends:{" "}
                {h.first_event_date ?? "—"} → {h.last_event_date ?? "—"}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => toggleFollow(h.team_id, `${h.program} ${h.team}`)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #14b8a6",
                  background: followedIds.has(h.team_id)
                    ? "rgba(20,184,166,0.15)"
                    : "transparent",
                  color: "#14b8a6",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {followedIds.has(h.team_id) ? "Following" : "Follow"}
              </button>

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
          </div>
        ))}
      </div>
    </main>
  );
}