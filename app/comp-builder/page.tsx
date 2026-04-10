"use client";

import React, { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

const STORAGE_KEY = "ecs_comp_builder_email_v1";
const COMP_STORAGE_KEY = "ecs_comp_builder_state_v1";
const SAVE_TO_SUPABASE = true;

const supabase =
  SAVE_TO_SUPABASE
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : null;

const ROLE_OPTIONS = ["Parent", "Coach", "Athlete", "Owner"] as const;
type Role = (typeof ROLE_OPTIONS)[number];

type TeamOption = {
  id: string;
  team_id: string;
  name: string;
  program: string;
  team: string;
};

type TeamEventRow = {
  team_id: string | null;
  event_id: string | null;
  program: string | null;
  team: string | null;
  event_name: string | null;
  weekend_date: string | null;
  deductions: number | null;
  performance_score: number | null;
  event_score: number | null;
  ceiling_score_true: number | null;
  ceiling_supported: boolean;
  ceiling_method: string | null;
  ceiling_delta: number | null;
  round_count: number | null;
};

type TeamPerformanceRow = {
  team_id: string | null;
  event_id: string | null;
  weekend_date: string | null;
  round_phase: string | null;
  deductions: number | null;
  performance_score: number | null;
  event_score: number | null;
};

type TableSortKey =
  | "team"
  | "avgScore"
  | "ceiling"
  | "hitZeroRate"
  | "lastCompDate"
  | "lastCompScore";

const TEAM_COLORS = [
  "#22d3ee",
  "#f472b6",
  "#fbbf24",
  "#34d399",
  "#a78bfa",
  "#fb7185",
  "#60a5fa",
  "#4ade80",
  "#f97316",
  "#c084fc",
];

function loadSavedCompState(): {
  roster: TeamOption[];
  primaryTeamId: string;
} {
  try {
    const raw = window.localStorage.getItem(COMP_STORAGE_KEY);
    if (!raw) {
      return { roster: [], primaryTeamId: "" };
    }

    const parsed = JSON.parse(raw) as {
      roster?: TeamOption[];
      primaryTeamId?: string;
    };

    return {
      roster: Array.isArray(parsed?.roster) ? parsed.roster : [],
      primaryTeamId:
        typeof parsed?.primaryTeamId === "string" ? parsed.primaryTeamId : "",
    };
  } catch (error) {
    console.error("Failed to load saved Comp Builder state:", error);
    return { roster: [], primaryTeamId: "" };
  }
}

function saveCompState(roster: TeamOption[], primaryTeamId: string) {
  try {
    window.localStorage.setItem(
      COMP_STORAGE_KEY,
      JSON.stringify({ roster, primaryTeamId })
    );
  } catch (error) {
    console.error("Failed to save Comp Builder state:", error);
  }
}

function formatScore(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toFixed(3);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function computeHitRate(rows: { deductions: number | null }[]) {
  let hits = 0;
  let total = 0;

  for (const r of rows) {
    const ded = Number(r.deductions ?? 0);

    if (Number.isFinite(ded)) {
      total += 1;
      if (ded === 0) hits += 1;
    }
  }

  const rate = total ? hits / total : 0;

  return {
    hits,
    total,
    pct: rate * 100,
  };
}

function computeAverageCeiling(rows: TeamEventRow[]) {
  const values = rows
    .filter((r) => r.ceiling_supported)
    .map((r) => r.ceiling_score_true)
    .filter((v): v is number => typeof v === "number");

  if (!values.length) return null;

  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

export default function CompBuilderPage() {
  return <CompBuilderInner />;
}

function CompBuilderInner() {
  const [gateEmail, setGateEmail] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<TeamOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchInputKey, setSearchInputKey] = useState(0);

  const [teamRows, setTeamRows] = useState<Record<string, TeamEventRow[]>>({});
  const [teamPerformanceRows, setTeamPerformanceRows] = useState<
    Record<string, TeamPerformanceRow[]>
  >({});
  const [dataLoading, setDataLoading] = useState(false);

  const [roster, setRoster] = useState<TeamOption[]>([]);
  const [primaryTeamId, setPrimaryTeamId] = useState("");

  const [showBarScore, setShowBarScore] = useState(true);
  const [showBarCeiling, setShowBarCeiling] = useState(true);

  const [expandedTeams, setExpandedTeams] = useState<string[]>([]);
  const [tableSortKey, setTableSortKey] = useState<TableSortKey>("avgScore");
  const [tableSortDir, setTableSortDir] = useState<"asc" | "desc">("desc");
  const [premiumLoading, setPremiumLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);

  const toggleRole = (role: Role) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  useEffect(() => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        setUnlocked(true);
        setGateEmail(existing);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const saved = loadSavedCompState();
    setRoster(saved.roster);
    setPrimaryTeamId(saved.primaryTeamId);
  }, []);

  useEffect(() => {
    const runSearch = async () => {
      const term = searchTerm.trim();

      if (!supabase || term.length < 2) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      setSearchLoading(true);

      const safeTerm = term.replace(/,/g, " ").trim();

      const { data, error } = await supabase
        .from("v_team_event_scores")
        .select("team_id, program, team")
        .not("team", "is", null)
        .or(`team.ilike.%${safeTerm}%,program.ilike.%${safeTerm}%`)
        .limit(200);

      if (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      const seen = new Set<string>();
      const results: TeamOption[] = [];

      for (const row of (data ?? []) as {
        team_id: string | null;
        program: string | null;
        team: string | null;
      }[]) {
        if (!row.team) continue;

        const cleanProgram = row.program?.trim() ?? "";
        const cleanTeam = row.team.trim();
        const cleanTeamId = String(row.team_id ?? "").trim();
        if (!cleanTeamId) continue;

        const label = cleanProgram ? `${cleanProgram} - ${cleanTeam}` : cleanTeam;

        if (seen.has(cleanTeamId)) continue;
        seen.add(cleanTeamId);

        results.push({
          id: cleanTeamId,
          team_id: cleanTeamId,
          name: label,
          program: cleanProgram,
          team: cleanTeam,
        });
      }

      const q = safeTerm.toLowerCase();

      results.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aProgram = a.program.toLowerCase();
        const bProgram = b.program.toLowerCase();
        const aTeam = a.team.toLowerCase();
        const bTeam = b.team.toLowerCase();

        const aStarts =
          aName.startsWith(q) || aProgram.startsWith(q) || aTeam.startsWith(q) ? 1 : 0;
        const bStarts =
          bName.startsWith(q) || bProgram.startsWith(q) || bTeam.startsWith(q) ? 1 : 0;

        if (aStarts !== bStarts) return bStarts - aStarts;

        const aProgramMatch = aProgram.includes(q) ? 1 : 0;
        const bProgramMatch = bProgram.includes(q) ? 1 : 0;

        if (aProgramMatch !== bProgramMatch) return bProgramMatch - aProgramMatch;

        return a.name.localeCompare(b.name);
      });

      setSearchResults(results);
      setSearchLoading(false);
    };

    const timeout = setTimeout(runSearch, 250);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    const loadRosterData = async () => {
      if (!supabase || roster.length === 0) {
        setTeamRows({});
        setTeamPerformanceRows({});
        return;
      }

      setDataLoading(true);

      const teamIds = Array.from(new Set(roster.map((t) => t.team_id)));

      const { data: eventData, error: eventError } = await supabase
        .from("v_team_event_scores")
        .select(
          "team_id, event_id, program, team, event_name, weekend_date, deductions, performance_score, event_score"
        )
        .in("team_id", teamIds)
        .not("event_score", "is", null)
        .order("weekend_date", { ascending: true });

      if (eventError) {
        console.error("Failed to load roster event rows:", eventError);
        setTeamRows({});
        setTeamPerformanceRows({});
        setDataLoading(false);
        return;
      }

      const eventRows = (eventData ?? []) as TeamEventRow[];

      const { data: perfData, error: perfError } = await supabase
        .from("v_results_normalized")
        .select(
          "team_id, event_id, weekend_date, round_phase, deductions, performance_score, event_score"
        )
        .in("team_id", teamIds)
        .in("round_phase", ["Prelims", "Finals"])
        .order("weekend_date", { ascending: true });

      if (perfError) {
        console.error("Failed to load performance rows:", perfError);
      }

      const eventIds = Array.from(
        new Set(eventRows.map((r) => String(r.event_id ?? "")).filter(Boolean))
      );

      let ceilingData: any[] = [];

      if (teamIds.length > 0 && eventIds.length > 0) {
        const { data: ceilingRes, error: ceilingError } = await supabase
          .from("mv_team_event_ceiling_rebuilt")
          .select(
            "team_id, event_id, ceiling_score, ceiling_delta, ceiling_method, ceiling_supported, round_count"
          )
          .in("team_id", teamIds)
          .in("event_id", eventIds);

        if (ceilingError) {
          console.error("Failed to load ceiling rows:", ceilingError);
        } else {
          ceilingData = ceilingRes ?? [];
        }
      }

      const ceilingMap = new Map(
        ceilingData.map((c: any) => [
          `${String(c.team_id)}|||${String(c.event_id)}`,
          c,
        ])
      );

      const groupedEvents: Record<string, TeamEventRow[]> = {};
      const groupedPerformances: Record<string, TeamPerformanceRow[]> = {};

      for (const rosterTeam of roster) {
        groupedEvents[rosterTeam.team_id] = [];
        groupedPerformances[rosterTeam.team_id] = [];
      }

      for (const row of eventRows) {
        const key = `${String(row.team_id ?? "")}|||${String(row.event_id ?? "")}`;
        const ceiling = ceilingMap.get(key);

        const merged: TeamEventRow = {
          ...row,
          ceiling_score_true: ceiling?.ceiling_score ?? null,
          ceiling_delta: ceiling?.ceiling_delta ?? null,
          ceiling_method: ceiling?.ceiling_method ?? null,
          ceiling_supported: ceiling?.ceiling_supported ?? false,
          round_count: ceiling?.round_count ?? null,
        };

        const teamId = String(row.team_id ?? "");
        if (!teamId) continue;
        if (!groupedEvents[teamId]) groupedEvents[teamId] = [];
        groupedEvents[teamId].push(merged);
      }

      for (const row of (perfData ?? []) as TeamPerformanceRow[]) {
        const teamId = String(row.team_id ?? "");
        if (!teamId) continue;
        if (!groupedPerformances[teamId]) groupedPerformances[teamId] = [];
        groupedPerformances[teamId].push(row);
      }

      setTeamRows(groupedEvents);
      setTeamPerformanceRows(groupedPerformances);
      setDataLoading(false);
    };

    loadRosterData();
  }, [roster]);

  useEffect(() => {
  let mounted = true;

  async function checkPremium() {
    if (!supabase) {
      if (!mounted) return;
      setSession(null);
      setIsPremium(false);
      setPremiumLoading(false);
      return;
    }

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
      .single();

    if (!mounted) return;

    if (error) {
      console.error("profile fetch error:", error);
      setIsPremium(false);
      setPremiumLoading(false);
      return;
    }

    setIsPremium(Boolean(data?.is_premium));
    setPremiumLoading(false);
  }

  checkPremium();

  const authListener = supabase?.auth.onAuthStateChange(() => {
    checkPremium();
  });

  return () => {
    mounted = false;
    authListener?.data.subscription.unsubscribe();
  };
}, []);

  const unlock = async () => {
    setMsg("");
    setStatus("loading");

    const email = gateEmail.trim();

    if (!email || !email.includes("@")) {
      setStatus("error");
      setMsg("Please enter your email to continue.");
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, email);
    } catch {
      // ignore
    }

    if (SAVE_TO_SUPABASE && supabase) {
      const { error } = await supabase.from("waitlist").insert({
        email: email.toLowerCase(),
        source: "comp_builder_gate",
        roles: roles.length ? roles : null,
      });

      if (error && !error.message.toLowerCase().includes("duplicate")) {
        setStatus("error");
        setMsg("Saved locally, but failed to save to waitlist.");
        setUnlocked(true);
        return;
      }
    }

    setUnlocked(true);
    setStatus("idle");
  };

  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(COMP_STORAGE_KEY);
    } catch {
      // ignore
    }

    setUnlocked(false);
    setGateEmail("");
    setMsg("");
    setStatus("idle");

    setSearchTerm("");
    setSearchResults([]);
    setSearchInputKey((prev) => prev + 1);

    setRoster([]);
    setPrimaryTeamId("");
    setExpandedTeams([]);
    setTeamRows({});
    setTeamPerformanceRows({});
  };

  const primaryMetrics = useMemo(() => {
    if (!primaryTeamId) return null;

    const rows = teamRows[primaryTeamId] ?? [];
    const perfRows = teamPerformanceRows[primaryTeamId] ?? [];

    const scores = rows
      .map((r) => r.event_score)
      .filter((v): v is number => typeof v === "number");

    if (!scores.length) return null;

    const avgScore = scores.reduce((sum, val) => sum + val, 0) / scores.length;
    const bestScore = Math.max(...scores);
    const ceiling = computeAverageCeiling(rows);
    const hit = computeHitRate(perfRows);

    return {
      avgScore,
      ceiling,
      bestScore,
      hitZeroRate: hit.pct,
    };
  }, [primaryTeamId, teamRows, teamPerformanceRows]);

  const colorMap = useMemo(() => {
    return Object.fromEntries(
      roster.map((team, index) => [team.id, TEAM_COLORS[index % TEAM_COLORS.length]])
    ) as Record<string, string>;
  }, [roster]);

  const barData = useMemo(() => {
    const rows = roster
      .map((team) => {
        const eventRows = teamRows[team.id] ?? [];
        const scores = eventRows
          .map((r) => r.event_score)
          .filter((v): v is number => typeof v === "number");

        const avgScore = scores.length
          ? scores.reduce((sum, val) => sum + val, 0) / scores.length
          : 0;

        const ceiling = computeAverageCeiling(eventRows) ?? 0;

        return {
          teamId: team.id,
          name: team.name.length > 28 ? `${team.name.slice(0, 28)}…` : team.name,
          fullName: team.name,
          avgScore,
          ceiling,
          isPrimary: team.id === primaryTeamId,
        };
      })
      .filter((row) => row.avgScore > 0 || row.ceiling > 0);

    return rows.sort((a, b) => {
      if (!showBarScore && showBarCeiling) {
        return b.ceiling - a.ceiling;
      }

      return b.avgScore - a.avgScore;
    });
  }, [roster, teamRows, showBarScore, showBarCeiling, primaryTeamId]);

  const barDomain = useMemo(() => {
    const values: number[] = [];

    for (const row of barData) {
      if (showBarScore && Number.isFinite(row.avgScore)) {
        values.push(row.avgScore);
      }
      if (showBarCeiling && Number.isFinite(row.ceiling)) {
        values.push(row.ceiling);
      }
    }

    if (!values.length) return [0, 100] as [number, number];

    const min = Math.min(...values);
    const max = Math.max(...values);

    const paddedMin = Math.floor((min - 0.5) * 1000) / 1000;
    const paddedMax = Math.ceil((max + 0.5) * 1000) / 1000;

    return [paddedMin, paddedMax] as [number, number];
  }, [barData, showBarScore, showBarCeiling]);

  function addTeam(team: TeamOption) {
    if (roster.some((t) => t.id === team.id)) return;
    if (roster.length >= 12) return;

    const nextRoster = [...roster, team];
    const nextPrimaryTeamId = roster.length === 0 ? team.id : primaryTeamId;

    setRoster(nextRoster);
    setPrimaryTeamId(nextPrimaryTeamId);
    saveCompState(nextRoster, nextPrimaryTeamId);

    setSearchTerm("");
    setSearchResults([]);
    setSearchInputKey((prev) => prev + 1);
  }

  function removeTeam(teamId: string) {
    const nextRoster = roster.filter((t) => t.id !== teamId);
    const nextPrimaryTeamId =
      primaryTeamId === teamId ? nextRoster[0]?.id ?? "" : primaryTeamId;

    setRoster(nextRoster);
    setPrimaryTeamId(nextPrimaryTeamId);
    setExpandedTeams((prev) => prev.filter((id) => id !== teamId));
    saveCompState(nextRoster, nextPrimaryTeamId);
  }

  function setFocusTeam(teamId: string) {
    setPrimaryTeamId(teamId);
    saveCompState(roster, teamId);
  }

  function toggleExpanded(teamId: string) {
    setExpandedTeams((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId]
    );
  }

  function sortTableBy(key: TableSortKey) {
    if (tableSortKey === key) {
      setTableSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTableSortKey(key);
      setTableSortDir(key === "team" ? "asc" : "desc");
    }
  }

  const tableData = useMemo(() => {
    const rows = roster.map((team) => {
      const comps = (teamRows[team.id] ?? [])
        .filter((r) => typeof r.event_score === "number")
        .sort((a, b) =>
          String(a.weekend_date ?? "").localeCompare(String(b.weekend_date ?? ""))
        );

      const perfRows = teamPerformanceRows[team.team_id] ?? [];

      const scores = comps
        .map((r) => r.event_score)
        .filter((v): v is number => typeof v === "number");

      const avgScore = scores.length
        ? scores.reduce((sum, val) => sum + val, 0) / scores.length
        : 0;

      const ceiling = computeAverageCeiling(comps) ?? 0;
      const hit = computeHitRate(perfRows);
      const lastComp = comps.length ? comps[comps.length - 1] : null;

      return {
        teamId: team.id,
        team: team.name,
        color: colorMap[team.id],
        avgScore,
        ceiling,
        hitZeroRate: hit.pct,
        lastCompDate: lastComp?.weekend_date ?? "",
        lastCompScore:
          typeof lastComp?.event_score === "number" ? lastComp.event_score : 0,
        comps: comps.map((c, idx) => ({
          id: `${team.id}-${idx}`,
          eventName: c.event_name ?? "Unknown Event",
          eventDate: c.weekend_date ?? "",
          eventScore: typeof c.event_score === "number" ? c.event_score : null,
          eventCeilingScore:
            c.ceiling_supported && typeof c.ceiling_score_true === "number"
              ? c.ceiling_score_true
              : null,
        })),
      };
    });

    return [...rows].sort((a, b) => {
      let result = 0;

      switch (tableSortKey) {
        case "team":
          result = a.team.localeCompare(b.team);
          break;
        case "avgScore":
          result = a.avgScore - b.avgScore;
          break;
        case "ceiling":
          result = a.ceiling - b.ceiling;
          break;
        case "hitZeroRate":
          result = a.hitZeroRate - b.hitZeroRate;
          break;
        case "lastCompDate":
          result = a.lastCompDate.localeCompare(b.lastCompDate);
          break;
        case "lastCompScore":
          result = a.lastCompScore - b.lastCompScore;
          break;
      }

      return tableSortDir === "asc" ? result : -result;
    });
  }, [roster, teamRows, teamPerformanceRows, colorMap, tableSortKey, tableSortDir]);

  const primaryTeam = roster.find((t) => t.id === primaryTeamId);

  const lineupReady = roster.length >= 2;

const showPremiumResults = !premiumLoading && isPremium;
const shouldGateResults = lineupReady && !showPremiumResults;
const lockedHref = !session
  ? "/login?next=/comp-builder"
  : "/upgrade";
const lockedCtaLabel = "Unlock Your Results";

  function splitProgramTeam(label: string) {
    const parts = label.split(" - ");
    if (parts.length <= 1) {
      return { program: label, team: "" };
    }

    return {
      program: parts.slice(0, -1).join(" - "),
      team: parts[parts.length - 1],
    };
  }

  let primaryBannerText = "Add your Focus Team";

  if (roster.length === 0) {
    primaryBannerText = " ";
  } else if (!primaryTeam) {
    primaryBannerText = "Select your Focus Team";
  } else {
    primaryBannerText = `Your Focus Team: ${primaryTeam.name}`;
  }

  if (false && !unlocked) {
    return (
      <main className="min-h-screen bg-[#0B0F1A] text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-semibold">Comp Builder (Beta Access)</h1>
          <p className="mt-1 text-sm text-white/70">
            Build your own competition lineup and compare teams before they hit the mat.
          </p>
          <p className="mt-1 text-sm text-white/50">
            Free during Beta. Premium coming soon.
          </p>

          <label className="mt-5 block text-sm text-white/80">Email</label>
          <input
            value={gateEmail}
            onChange={(e) => setGateEmail(e.target.value)}
            placeholder="Enter your email for instant access"
            className="mt-2 w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-teal-400/50"
          />

          {msg && (
            <div
              className={`mt-3 text-sm ${
                status === "error" ? "text-red-300" : "text-white/80"
              }`}
            >
              {msg}
            </div>
          )}

          <div className="mt-4">
            <div className="text-sm text-white/80">I’m a...</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="h-4 w-4"
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={unlock}
            disabled={status === "loading"}
            className="mt-4 w-full rounded-md bg-teal-500/90 hover:bg-teal-500 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {status === "loading" ? "Opening..." : "Unlock Comp Builder"}
          </button>

          <p className="mt-4 text-xs text-white/50">
            No spam. Early access + updates before anyone else.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0F1A] text-white px-4 py-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Comp Builder</h1>
            <h1 className="text-2xl font-bold">
              See how teams stack up before they compete
            </h1>

            <p className="text-slate-300 mt-2">
              Add up to 12 teams and instantly compare ceiling, consistency, and scores.
            </p>
          </div>

          <div className="flex-1 flex justify-center">
            <div className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500/20 via-teal-400/20 to-cyan-500/20 border border-cyan-300/30 shadow-[0_0_20px_rgba(34,211,238,0.12)] text-sm md:text-base font-semibold text-cyan-100 tracking-wide">
              {primaryBannerText}
            </div>
          </div>

          {/* 
          <button
            onClick={reset}
            className="rounded-md border border-white/15 hover:bg-white/5 px-3 py-2 text-sm"
          >
            Reset Gate
          </button>
          */}
        </div>

                {shouldGateResults ? (
          <div className="mb-6 rounded-2xl border border-teal-400/15 bg-[#131f3a]/95 p-6">
            <div className="text-[11px] uppercase tracking-[0.24em] text-teal-300">
              Premium Comp Builder
            </div>

            <div className="mt-3 text-2xl font-bold tracking-tight text-white md:text-3xl">
              Your lineup is ready. Now see how it actually stacks up.
            </div>

            <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
              You’ve built the field. Unlock the full comp view to see who leads on
              score, who has more upside, and which teams have been more consistent.
            </p>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-lg">🏆</div>
                <div className="mt-2 font-semibold text-white">Full team ranking</div>
                <div className="mt-1 text-sm text-slate-300">
                  See how the whole lineup orders out right now.
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-lg">🎯</div>
                <div className="mt-2 font-semibold text-white">Ceiling view</div>
                <div className="mt-1 text-sm text-slate-300">
                  See which teams actually have the upside to win.
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-lg">🔥</div>
                <div className="mt-2 font-semibold text-white">Consistency view</div>
                <div className="mt-1 text-sm text-slate-300">
                  See which teams have been steadier across performances.
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={lockedHref}
                className="inline-flex items-center rounded-xl bg-gradient-to-r from-teal-400 to-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(45,212,191,0.28)] transition hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(45,212,191,0.4)]"
              >
                {lockedCtaLabel}
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div className="rounded-2xl border border-white/10 bg-[#0E1530] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/60 mb-3">
                Average Event Score
              </div>
              <div className="rounded-xl border border-cyan-400/20 bg-black/20 p-4">
                <div className="text-xs text-white/60">Focus Team</div>
                <div className="mt-1 text-3xl font-bold text-cyan-300">
                  {formatScore(primaryMetrics?.avgScore)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0E1530] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/60 mb-3">
                Average Ceiling Score
              </div>
              <div className="rounded-xl border border-fuchsia-400/20 bg-black/20 p-4">
                <div className="text-xs text-white/60">Focus Team</div>
                <div className="mt-1 text-3xl font-bold text-fuchsia-300">
                  {formatScore(primaryMetrics?.ceiling)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0E1530] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/60 mb-3">
                Hit Zero Rate
              </div>
              <div className="rounded-xl border border-emerald-400/20 bg-black/20 p-4">
                <div className="text-xs text-white/60">Focus Team</div>
                <div className="mt-1 text-3xl font-bold text-emerald-300">
                  {formatPercent(primaryMetrics?.hitZeroRate)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0E1530] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/60 mb-3">
                Best Score
              </div>
              <div className="rounded-xl border border-amber-400/20 bg-black/20 p-4">
                <div className="text-xs text-white/60">Focus Team</div>
                <div className="mt-1 text-3xl font-bold text-amber-300">
                  {formatScore(primaryMetrics?.bestScore)}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
          <aside className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold">Search Teams</h2>

            <input
              key={searchInputKey}
              defaultValue=""
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Build your roster..."
              className="mt-4 w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-teal-400/50"
            />

            <div className="mt-4 space-y-2 max-h-[280px] overflow-auto pr-1">
              {searchTerm.trim().length < 2 ? (
                <div className="mt-3 text-sm text-slate-400 space-y-1">
                  <div>1. Search and add teams</div>
                  <div>2. Set your focus team</div>
                  <div>3. See how they stack up instantly</div>
                </div>
              ) : searchLoading ? (
                <div className="text-sm text-white/40">Searching teams...</div>
              ) : searchResults.length === 0 ? (
                <div className="text-sm text-white/40">No teams found.</div>
              ) : (
                searchResults.map((team) => {
                  const alreadyAdded = roster.some((t) => t.id === team.id);

                  return (
                    <div
                      key={team.id}
                      className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                    >
                      <div className="text-sm">{team.name}</div>
                      <button
                        onClick={() => addTeam(team)}
                        disabled={alreadyAdded || roster.length >= 12}
                        className="mt-2 rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5 disabled:opacity-40"
                      >
                        {alreadyAdded ? "Already in roster" : "Add to roster"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Roster</h3>
                <span className="text-xs text-white/50">{roster.length} / 12</span>
              </div>

              <div className="text-[11px] text-white/40 mt-1">
                Up to 12 teams!
              </div>

              <div className="mt-3 space-y-2">
                {roster.map((team) => {
                  const isPrimary = primaryTeamId === team.id;

                  return (
                    <div
                      key={team.id}
                      className={`rounded-xl border px-3 py-3 ${
                        isPrimary
                          ? "border-cyan-400/30 bg-cyan-400/10"
                          : "border-white/10 bg-black/20"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className="mt-1 h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: colorMap[team.id] }}
                        />
                        <div className="text-sm font-medium">{team.name}</div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => setFocusTeam(team.id)}
                          className={`rounded-md px-2 py-1 text-xs ${
                            isPrimary
                              ? "bg-teal-500/90 text-white"
                              : "border border-white/10 hover:bg-white/10"
                          }`}
                        >
                          {isPrimary ? "FOCUS" : "Set Focus"}
                        </button>

                        <button
                          onClick={() => removeTeam(team.id)}
                          className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

                    <section className="space-y-6">
            {shouldGateResults ? (
              <div className="rounded-2xl border border-white/10 bg-[#08122A] p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Your Comp Dashboard</h2>
                    <p className="text-sm text-white/60">
                      Your lineup is built. Unlock premium to see the full results.
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-white/10 bg-black/10 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-sm font-medium text-white">What unlocks</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        <div>• Full ranking across your lineup</div>
                        <div>• Score + ceiling comparison chart</div>
                        <div>• Team-by-team comp table</div>
                        <div>• Event-level drilldown</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-sm font-medium text-white">Why it matters</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        <div>• See who is actually ahead right now</div>
                        <div>• See who still has winning upside</div>
                        <div>• See who has been the steadier team</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href={lockedHref}
                      className="inline-flex items-center rounded-xl bg-gradient-to-r from-teal-400 to-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(45,212,191,0.28)] transition hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(45,212,191,0.4)]"
                    >
                      {lockedCtaLabel}
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-white/10 bg-[#08122A] p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">Your Comp Dashboard</h2>
                      <p className="text-sm text-white/60">
                        Set a focus team to see how they stack up.
                      </p>
                    </div>

                    <div className="flex gap-6">
                      <div className="flex flex-col items-start">
                        <label className="flex items-center gap-2 text-sm leading-none">
                          <input
                            type="checkbox"
                            checked={showBarScore}
                            onChange={(e) => setShowBarScore(e.target.checked)}
                          />
                          Event Score
                        </label>
                        <div className="ml-5 mt-2 h-2 w-14 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.35)]" />
                      </div>

                      <div className="flex flex-col items-start">
                        <label className="flex items-center gap-2 text-sm leading-none">
                          <input
                            type="checkbox"
                            checked={showBarCeiling}
                            onChange={(e) => setShowBarCeiling(e.target.checked)}
                          />
                          Ceiling Score
                        </label>
                        <div className="ml-5 mt-2 h-2 w-14 rounded-full bg-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.35)]" />
                      </div>
                    </div>
                  </div>

                  <div
                    className="mt-6 rounded-xl border border-white/10 bg-black/10 p-4"
                    style={{ height: `${Math.max(360, barData.length * 68)}px` }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={barData}
                        layout="vertical"
                        margin={{ top: 8, right: 20, left: 10, bottom: 8 }}
                        barCategoryGap={6}
                      >
                        <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                        <XAxis
                          type="number"
                          domain={barDomain}
                          tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                          axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                          tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
                        />
                        <YAxis
                          type="category"
                          dataKey="fullName"
                          width={240}
                          tick={(props: any) => {
                            const { x, y, payload } = props;
                            const fullName = String(payload?.value ?? "");
                            const { program, team } = splitProgramTeam(fullName);

                            return (
                              <g transform={`translate(${x},${y})`}>
                                <text
                                  x={-10}
                                  y={-2}
                                  textAnchor="end"
                                  fill="rgba(255,255,255,0.72)"
                                  fontSize="11"
                                >
                                  {program}
                                </text>
                                {team && (
                                  <text
                                    x={-10}
                                    y={12}
                                    textAnchor="end"
                                    fill="rgba(255,255,255,0.92)"
                                    fontSize="12"
                                    fontWeight="600"
                                  >
                                    {team}
                                  </text>
                                )}
                              </g>
                            );
                          }}
                          axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                          tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            typeof value === "number" ? value.toFixed(3) : String(value ?? "--"),
                            name === "avgScore" ? "Average Event Score" : "Average Ceiling Score",
                          ]}
                          labelFormatter={(label) => label}
                          contentStyle={{
                            backgroundColor: "#0b1220",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 12,
                            color: "#e5e7eb",
                          }}
                          labelStyle={{
                            color: "#ffffff",
                            fontWeight: 600,
                          }}
                          itemStyle={{
                            color: "#cbd5f5",
                          }}
                        />

                        {showBarScore && (
                          <Bar
                            dataKey="avgScore"
                            shape={(props: any) => {
                              const { x, y, width, height, payload } = props;
                              const isPrimary = payload?.isPrimary;

                              return (
                                <rect
                                  x={x}
                                  y={isPrimary ? y - 2 : y}
                                  width={width}
                                  height={isPrimary ? height + 4 : height}
                                  rx={6}
                                  ry={6}
                                  fill={isPrimary ? "#67e8f9" : "#22d3ee"}
                                  stroke={isPrimary ? "#ffffff" : "none"}
                                  strokeWidth={isPrimary ? 3 : 0}
                                  style={{
                                    filter: isPrimary
                                      ? "drop-shadow(0 0 12px rgba(34,211,238,0.9))"
                                      : "none",
                                  }}
                                />
                              );
                            }}
                          />
                        )}

                        {showBarCeiling && (
                          <Bar
                            dataKey="ceiling"
                            shape={(props: any) => {
                              const { x, y, width, height, payload } = props;
                              const isPrimary = payload?.isPrimary;

                              return (
                                <rect
                                  x={x}
                                  y={isPrimary ? y - 2 : y}
                                  width={width}
                                  height={isPrimary ? height + 4 : height}
                                  rx={6}
                                  ry={6}
                                  fill={isPrimary ? "#f9a8d4" : "#f472b6"}
                                  stroke={isPrimary ? "#ffffff" : "none"}
                                  strokeWidth={isPrimary ? 3 : 0}
                                  style={{
                                    filter: isPrimary
                                      ? "drop-shadow(0 0 12px rgba(244,114,182,0.9))"
                                      : "none",
                                  }}
                                />
                              );
                            }}
                          />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#08122A] p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">Your Comp Data</h2>
                      <p className="text-sm text-white/60">
                        Click each team to drill down into Event-Level data.
                      </p>
                    </div>
                    {dataLoading && (
                      <div className="text-sm text-white/50">Loading team data...</div>
                    )}
                  </div>

                  <div className="mt-6 overflow-x-auto rounded-xl border border-white/10 bg-black/10">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white/5 text-white/70">
                        <tr>
                          <th
                            className="px-4 py-3 text-left cursor-pointer"
                            onClick={() => sortTableBy("team")}
                          >
                            Team
                          </th>
                          <th
                            className="px-4 py-3 text-left cursor-pointer"
                            onClick={() => sortTableBy("avgScore")}
                          >
                            Avg Event
                          </th>
                          <th
                            className="px-4 py-3 text-left cursor-pointer"
                            onClick={() => sortTableBy("ceiling")}
                          >
                            Avg Ceiling
                          </th>
                          <th
                            className="px-4 py-3 text-left cursor-pointer"
                            onClick={() => sortTableBy("hitZeroRate")}
                          >
                            Hit Zero Rate
                          </th>
                          <th
                            className="px-4 py-3 text-left cursor-pointer"
                            onClick={() => sortTableBy("lastCompDate")}
                          >
                            Last Comp Date
                          </th>
                          <th
                            className="px-4 py-3 text-left cursor-pointer"
                            onClick={() => sortTableBy("lastCompScore")}
                          >
                            Last Comp Event Score
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {tableData.map((row) => {
                          const expanded = expandedTeams.includes(row.teamId);

                          return (
                            <Fragment key={row.teamId}>
                              <tr
                                className={`border-t border-white/10 cursor-pointer ${
                                  row.teamId === primaryTeamId
                                    ? "bg-cyan-500/10 hover:bg-cyan-500/20"
                                    : "hover:bg-white/5"
                                }`}
                                onClick={() => toggleExpanded(row.teamId)}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="h-2.5 w-2.5 rounded-full"
                                      style={{ backgroundColor: row.color }}
                                    />
                                    <span className="font-medium text-white">{row.team}</span>
                                  </div>
                                </td>

                                <td className="px-4 py-3 text-cyan-300">
                                  {row.avgScore ? row.avgScore.toFixed(3) : "--"}
                                </td>

                                <td className="px-4 py-3 text-pink-300">
                                  {row.ceiling ? row.ceiling.toFixed(3) : "--"}
                                </td>

                                <td className="px-4 py-3 text-emerald-300">
                                  {Math.round(row.hitZeroRate)}%
                                </td>

                                <td className="px-4 py-3 text-white/80">
                                  {formatDate(row.lastCompDate)}
                                </td>

                                <td className="px-4 py-3 text-amber-300">
                                  {row.lastCompScore ? row.lastCompScore.toFixed(3) : "--"}
                                </td>
                              </tr>

                              {expanded && (
                                <tr className="border-t border-white/10 bg-white/[0.03]">
                                  <td colSpan={6} className="px-4 py-4">
                                    <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/20">
                                      <table className="min-w-full text-xs">
                                        <thead className="bg-white/5 text-white/60">
                                          <tr>
                                            <th className="px-3 py-2 text-left">Event Name</th>
                                            <th className="px-3 py-2 text-left">Event Date</th>
                                            <th className="px-3 py-2 text-left">Event Score</th>
                                            <th className="px-3 py-2 text-left">
                                              Event Ceiling Score
                                            </th>
                                          </tr>
                                        </thead>

                                        <tbody>
                                          {row.comps.map((comp) => (
                                            <tr key={comp.id} className="border-t border-white/10">
                                              <td className="px-3 py-2 text-white/85">
                                                {comp.eventName}
                                              </td>
                                              <td className="px-3 py-2 text-white/70">
                                                {formatDate(comp.eventDate)}
                                              </td>
                                              <td className="px-3 py-2 text-cyan-300">
                                                {comp.eventScore != null
                                                  ? comp.eventScore.toFixed(3)
                                                  : "--"}
                                              </td>
                                              <td className="px-3 py-2 text-pink-300">
                                                {comp.eventCeilingScore != null
                                                  ? comp.eventCeilingScore.toFixed(3)
                                                  : "--"}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}