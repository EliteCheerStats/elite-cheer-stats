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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SUMMIT_EXPERIENCES = {
  D2_2026: {
    key: "D2_2026",
    label: "D2 Summit",
    mode: "pre" as const,
    scheduleEventId: "D2_2026",
    championshipEventId: null as string | null,
  },
  YOUTH_2026: {
    key: "YOUTH_2026",
    label: "Youth Summit",
    mode: "post" as const,
    scheduleEventId: null as string | null,
    championshipEventId: "14478867",
  },
};

type SummitExperienceKey = keyof typeof SUMMIT_EXPERIENCES;

const PREVIEW_COUNT_KEY = "ecs_summit_builder_preview_count_v1";
const FREE_PREVIEW_LIMIT = 2;
const FINALISTS_KEY = "ecs_summit_builder_finalists_D2_2026_v1";
const FINALISTS_ROSTER_KEY = "ecs_summit_builder_finalist_roster_D2_2026_v1";

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

type RoundPhase = "Wild Card" | "Prelims" | "Finals";

type ChampionshipOptionRow = {
  division: string | null;
  round_phase: string | null;
};

type ChampionshipTeamRow = {
  team_id: string | null;
  program: string | null;
  team: string | null;
};

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
type ChampionshipResultWithEcsRow = {
  event_id: string | number | null;
  event_name: string | null;
  division: string | null;
  round: string | null;
  rank: number | null;
  program: string | null;
  team: string | null;
  team_id: string | null;
  summit_score: number | null;
  ecs_average: number | null;
  score_delta: number | null;
};


type TableSortKey =
  | "team"
  | "avgScore"
  | "ceiling"
  | "hitZeroRate"
  | "lastCompDate"
  | "lastCompScore";

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

function loadFinalists(): string[] {
  try {
    const raw = window.localStorage.getItem(FINALISTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveFinalists(ids: string[]) {
  try {
    window.localStorage.setItem(FINALISTS_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

function loadFinalistRoster(): TeamOption[] {
  try {
    const raw = window.localStorage.getItem(FINALISTS_ROSTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item: any) => {
      return (
        item &&
        typeof item.id === "string" &&
        typeof item.team_id === "string" &&
        typeof item.name === "string" &&
        typeof item.program === "string" &&
        typeof item.team === "string"
      );
    });
  } catch {
    return [];
  }
}

function saveFinalistRoster(roster: TeamOption[]) {
  try {
    window.localStorage.setItem(FINALISTS_ROSTER_KEY, JSON.stringify(roster));
  } catch {
    // ignore
  }
}

function PostSummitTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const ecs = payload.find((item: any) => item.dataKey === "ecsAverage");
  const summit = payload.find((item: any) => item.dataKey === "summitScore");

  const ecsValue = typeof ecs?.value === "number" ? ecs.value : null;
  const summitValue = typeof summit?.value === "number" ? summit.value : null;
  const delta =
    ecsValue != null && summitValue != null ? summitValue - ecsValue : null;

  return (
    <div
      style={{
        backgroundColor: "#05030A",
        border: "1px solid rgba(245, 158, 11, 0.75)",
        borderRadius: 14,
        boxShadow: "0 0 28px rgba(0,0,0,0.85)",
        padding: "12px 14px",
        color: "#ffffff",
        minWidth: 260,
      }}
    >
      <div
        style={{
          color: "#ffffff",
          fontWeight: 800,
          marginBottom: 8,
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>

      {ecs && (
        <div
          style={{
            color: "#e5e7eb",
            fontWeight: 800,
            marginTop: 4,
          }}
        >
          ECS Average: {ecsValue != null ? ecsValue.toFixed(3) : ecs.value}
        </div>
      )}

      {summit && (
        <div
          style={{
            color: "#f59e0b",
            fontWeight: 800,
            marginTop: 6,
          }}
        >
          Summit Result:{" "}
          {summitValue != null ? summitValue.toFixed(3) : summit.value}
        </div>
      )}

      {delta != null && (
        <div
          style={{
            color: delta >= 0 ? "#34d399" : "#f87171",
            fontWeight: 800,
            marginTop: 8,
          }}
        >
          Difference: {delta >= 0 ? "+" : ""}
          {delta.toFixed(3)}
        </div>
      )}
    </div>
  );
}

export default function SummitBuilderPage() {
  const [selectedExperienceKey, setSelectedExperienceKey] =
    useState<SummitExperienceKey>("D2_2026");
  const selectedExperience = SUMMIT_EXPERIENCES[selectedExperienceKey];

  const [session, setSession] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumLoading, setPremiumLoading] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);

  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [availableDivisions, setAvailableDivisions] = useState<string[]>([]);
  const [availableRoundsByDivision, setAvailableRoundsByDivision] = useState<
    Record<string, string[]>
  >({});

  const [postDivisions, setPostDivisions] = useState<string[]>([]);
  const [postRoundsByDivision, setPostRoundsByDivision] = useState<Record<string, string[]>>({});
  const [selectedPostDivision, setSelectedPostDivision] = useState("");
  const [selectedPostRound, setSelectedPostRound] = useState<RoundPhase>("Finals");
  const [postResults, setPostResults] = useState<ChampionshipResultWithEcsRow[]>([]);
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState("");
  const [showPostEcsAverage, setShowPostEcsAverage] = useState(true);
  const [showPostSummitScore, setShowPostSummitScore] = useState(true);

  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedRound, setSelectedRound] = useState<RoundPhase>("Wild Card");
  const [activeView, setActiveView] = useState<RoundPhase>("Wild Card");

  const [loadedDivision, setLoadedDivision] = useState("");
  const [loadedRound, setLoadedRound] = useState<RoundPhase>("Wild Card");
  const [roster, setRoster] = useState<TeamOption[]>([]);
  const [finalists, setFinalists] = useState<string[]>([]);
  const [finalistRoster, setFinalistRoster] = useState<TeamOption[]>([]);
  const [primaryTeamId, setPrimaryTeamId] = useState("");

  const [teamRows, setTeamRows] = useState<Record<string, TeamEventRow[]>>({});
  const [teamPerformanceRows, setTeamPerformanceRows] = useState<
    Record<string, TeamPerformanceRow[]>
  >({});
  const [dataLoading, setDataLoading] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "error">("idle");
  const [loadMessage, setLoadMessage] = useState("");

  const [showBarScore, setShowBarScore] = useState(true);
  const [showBarCeiling, setShowBarCeiling] = useState(true);
  const [expandedTeams, setExpandedTeams] = useState<string[]>([]);
  const [tableSortKey, setTableSortKey] = useState<TableSortKey>("avgScore");
  const [tableSortDir, setTableSortDir] = useState<"asc" | "desc">("desc");

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

    const authListener = supabase.auth.onAuthStateChange(() => {
      checkPremium();
    });

    return () => {
      mounted = false;
      authListener?.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const savedIds = loadFinalists();
    const savedRoster = loadFinalistRoster();

    setFinalists(savedIds);
    setFinalistRoster(savedRoster.filter((team) => savedIds.includes(team.id)));
  }, []);

  useEffect(() => {
    setHasMounted(true);

    try {
      const raw = window.localStorage.getItem(PREVIEW_COUNT_KEY);
      const parsed = raw ? Number(raw) : 0;
      setPreviewCount(Number.isFinite(parsed) ? parsed : 0);
    } catch {
      setPreviewCount(0);
    }
  }, []);

  useEffect(() => {
    async function loadOptions() {
      setOptionsLoading(true);
      setOptionsError("");

      const { data, error } = await supabase
        .from("v_championship_builder")
        .select("division, round_phase")
        .eq("event_id", SUMMIT_EXPERIENCES.D2_2026.scheduleEventId)
        .order("division", { ascending: true })
        .order("round_phase", { ascending: true });

      if (error) {
        console.error("Failed to load championship options:", error);
        setOptionsError("Could not load Summit divisions.");
        setOptionsLoading(false);
        return;
      }

      const rows = (data ?? []) as ChampionshipOptionRow[];
      const divisionSet = new Set<string>();
      const roundsMap: Record<string, Set<string>> = {};

      for (const row of rows) {
        const division = String(row.division ?? "").trim();
        const round = String(row.round_phase ?? "").trim();
        if (!division || !round) continue;

        divisionSet.add(division);
        if (!roundsMap[division]) roundsMap[division] = new Set();
        roundsMap[division].add(round);
      }

      const divisions = Array.from(divisionSet).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );

      const normalizedRounds: Record<string, string[]> = {};
      for (const division of divisions) {
        const rounds = Array.from(roundsMap[division] ?? []);
        normalizedRounds[division] = ["Wild Card", "Prelims"].filter((r) =>
          rounds.includes(r)
        );
      }

      setAvailableDivisions(divisions);
      setAvailableRoundsByDivision(normalizedRounds);

      if (!selectedDivision && divisions.length) {
        const firstDivision = divisions[0];
        setSelectedDivision(firstDivision);
        setSelectedRound(
          (normalizedRounds[firstDivision]?.[0] as RoundPhase) ?? "Wild Card"
        );
        setActiveView((normalizedRounds[firstDivision]?.[0] as RoundPhase) ?? "Wild Card");
      }

      setOptionsLoading(false);
    }

    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadPostOptions() {
      if (selectedExperience.mode !== "post" || !selectedExperience.championshipEventId) {
        return;
      }

      setPostError("");

      const { data, error } = await supabase
        .from("v_championship_results_with_ecs")
        .select("division, round")
        .eq("event_id", selectedExperience.championshipEventId)
        .order("division", { ascending: true })
        .order("round", { ascending: true });

      if (error) {
        console.error("Failed to load post-Summit options:", error);
        setPostError("Could not load Summit results options.");
        return;
      }

      const divisionSet = new Set<string>();
      const roundMap: Record<string, Set<string>> = {};

      for (const row of (data ?? []) as { division: string | null; round: string | null }[]) {
        const division = String(row.division ?? "").trim();
        const round = String(row.round ?? "").trim();

        if (!division || !round) continue;

        divisionSet.add(division);
        if (!roundMap[division]) roundMap[division] = new Set<string>();
        roundMap[division].add(round);
      }

      const divisions = Array.from(divisionSet).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );

      const roundsByDivision: Record<string, string[]> = {};
      for (const division of divisions) {
        const rawRounds = Array.from(roundMap[division] ?? []);
        roundsByDivision[division] = ["Finals", "Prelims", "Wild Card"].filter((round) =>
          rawRounds.includes(round)
        );
      }

      setPostDivisions(divisions);
      setPostRoundsByDivision(roundsByDivision);

      if (!selectedPostDivision && divisions.length) {
        const firstDivision = divisions[0];
        setSelectedPostDivision(firstDivision);
        setSelectedPostRound(
          (roundsByDivision[firstDivision]?.[0] as RoundPhase) ?? "Finals"
        );
      }
    }

    loadPostOptions();
  }, [
    selectedExperience.mode,
    selectedExperience.championshipEventId,
    selectedPostDivision,
  ]);

  useEffect(() => {
    if (selectedExperience.mode !== "post") return;
    if (!selectedPostDivision) return;

    const rounds = postRoundsByDivision[selectedPostDivision] ?? [];
    if (rounds.length && !rounds.includes(selectedPostRound)) {
      setSelectedPostRound((rounds[0] as RoundPhase) ?? "Finals");
    }
  }, [selectedExperience.mode, selectedPostDivision, selectedPostRound, postRoundsByDivision]);

  useEffect(() => {
    async function loadPostResults() {
      if (
        selectedExperience.mode !== "post" ||
        !selectedExperience.championshipEventId ||
        !selectedPostDivision ||
        !selectedPostRound
      ) {
        setPostResults([]);
        return;
      }

      setPostLoading(true);
      setPostError("");

      const { data, error } = await supabase
        .from("v_championship_results_with_ecs")
        .select(
          "event_id, event_name, division, round, rank, program, team, team_id, summit_score, ecs_average, score_delta"
        )
        .eq("event_id", selectedExperience.championshipEventId)
        .eq("division", selectedPostDivision)
        .eq("round", selectedPostRound)
        .order("rank", { ascending: true });

      if (error) {
        console.error("Failed to load post-Summit results:", error);
        setPostError("Could not load Summit results.");
        setPostResults([]);
        setPostLoading(false);
        return;
      }

      setPostResults((data ?? []) as ChampionshipResultWithEcsRow[]);
      setPostLoading(false);
    }

    loadPostResults();
  }, [
    selectedExperience.mode,
    selectedExperience.championshipEventId,
    selectedPostDivision,
    selectedPostRound,
  ]);

  useEffect(() => {
    if (!selectedDivision) return;

    // Finals is a UI-only option. It is built from user selections, not from
    // v_championship_builder, so do not auto-reset it just because it is not
    // present in the DB-backed round list.
    if (selectedRound === "Finals") return;

    const rounds = availableRoundsByDivision[selectedDivision] ?? [];
    if (!rounds.includes(selectedRound)) {
      const nextRound = (rounds[0] as RoundPhase) ?? "Wild Card";
      setSelectedRound(nextRound);
      setActiveView(nextRound);
    }
  }, [selectedDivision, selectedRound, availableRoundsByDivision]);

  const activeRoster = useMemo(() => {
    if (activeView !== "Finals") return roster;

    const finalistSet = new Set(finalists);
    const merged = new Map<string, TeamOption>();

    // Important: Finals is built from every team the user added across Wild Card
    // and Prelims, not only from the currently loaded round roster.
    for (const team of finalistRoster) {
      if (finalistSet.has(team.id)) merged.set(team.id, team);
    }

    // Fallback for same-session additions if localStorage/state ever gets out of sync.
    for (const team of roster) {
      if (finalistSet.has(team.id)) merged.set(team.id, team);
    }

    return Array.from(merged.values());
  }, [activeView, roster, finalists, finalistRoster]);

  useEffect(() => {
    const loadRosterData = async () => {
      if (!activeRoster.length) {
        setTeamRows({});
        setTeamPerformanceRows({});
        return;
      }

      setDataLoading(true);

      const teamIds = Array.from(new Set(activeRoster.map((t) => t.team_id)));

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

      const eventIds = Array.from(
        new Set(eventRows.map((r) => String(r.event_id ?? "")).filter(Boolean))
      );

      let perfData: TeamPerformanceRow[] = [];

      if (teamIds.length > 0 && eventIds.length > 0) {
        const { data: perfRes, error: perfError } = await supabase
          .from("v_results_normalized")
          .select(
            "team_id, event_id, weekend_date, round_phase, deductions, performance_score, event_score"
          )
          .in("team_id", teamIds)
          .in("event_id", eventIds)
          .in("round_phase", ["Prelims", "Finals"])
          .order("weekend_date", { ascending: true });

        if (perfError) {
          console.error("Failed to load performance rows:", perfError);
        } else {
          perfData = (perfRes ?? []) as TeamPerformanceRow[];
        }
      }

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

      for (const rosterTeam of activeRoster) {
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

      for (const row of perfData) {
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
  }, [activeRoster]);

  const previewCountValue = hasMounted ? previewCount : 0;
  const previewLimitReached = previewCountValue >= FREE_PREVIEW_LIMIT;


  const lockedHref = !session
    ? "/login?next=/summit-builder"
    : "/upgrade";

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
      activeRoster.map((team, index) => [
        team.id,
        TEAM_COLORS[index % TEAM_COLORS.length],
      ])
    ) as Record<string, string>;
  }, [activeRoster]);

  const barData = useMemo(() => {
    const rows = activeRoster
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
  }, [activeRoster, teamRows, showBarScore, showBarCeiling, primaryTeamId]);

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

  const tableData = useMemo(() => {
    const rows = activeRoster.map((team) => {
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
  }, [activeRoster, teamRows, teamPerformanceRows, colorMap, tableSortKey, tableSortDir]);

  const primaryTeam = activeRoster.find((t) => t.id === primaryTeamId);

  let primaryBannerText = "Load a Summit division";

  if (activeRoster.length === 0) {
    primaryBannerText = " ";
  } else if (!primaryTeam) {
    primaryBannerText = "Select your Focus Team";
  } else {
    primaryBannerText = `Focus Team: ${primaryTeam.name}`;
  }

  function sortTableBy(key: TableSortKey) {
    if (tableSortKey === key) {
      setTableSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTableSortKey(key);
      setTableSortDir(key === "team" ? "asc" : "desc");
    }
  }

  function toggleExpanded(teamId: string) {
    setExpandedTeams((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId]
    );
  }

  function setFocusTeam(teamId: string) {
    setPrimaryTeamId(teamId);
  }

  function showUpgradeMessage(message = "Upgrade to keep using Summit Builder.") {
    setLoadStatus("error");
    setLoadMessage(message);
  }

  function clearLoadedDashboard() {
    setRoster([]);
    setTeamRows({});
    setTeamPerformanceRows({});
    setPrimaryTeamId("");
    setExpandedTeams([]);
    setLoadedDivision("");
  }

  function showPreviewGateAndClear(
    message = "You’ve used your 2 free Summit previews 👀 Upgrade to load more divisions, switch rounds, and build your Finals matchup."
  ) {
    clearLoadedDashboard();
    setActiveView(selectedRound);
    setLoadStatus("error");
    setLoadMessage(message);
  }

  function handleDivisionChange(nextDivision: string) {
    if (nextDivision !== selectedDivision) {
      setFinalists([]);
      setFinalistRoster([]);
      saveFinalists([]);
      saveFinalistRoster([]);
    }

    setSelectedDivision(nextDivision);

    const nextRounds = availableRoundsByDivision[nextDivision] ?? [];
    const nextRound = (nextRounds.includes(selectedRound)
      ? selectedRound
      : ((nextRounds[0] as RoundPhase) ?? "Wild Card"));

    setSelectedRound(nextRound);
    setActiveView(nextRound);

    if (!isPremium && previewLimitReached && hasLoaded) {
      showPreviewGateAndClear(
        "You’ve used your 2 free Summit previews 👀 Upgrade to load more divisions, switch rounds, and build your Finals matchup."
      );
    } else {
      setLoadStatus("idle");
      setLoadMessage("");
    }
  }

  function handleExperienceChange(nextKey: SummitExperienceKey) {
    setSelectedExperienceKey(nextKey);
    setLoadStatus("idle");
    setLoadMessage("");

    if (SUMMIT_EXPERIENCES[nextKey].mode === "post") {
      setPostError("");
      setSelectedPostRound("Finals");
    }
  }

  function handleRoundDropdownChange(nextRound: RoundPhase) {
    setSelectedRound(nextRound);

    if (nextRound === "Finals") {
      if (!isPremium) {
        showPreviewGateAndClear(
          "Build your Summit Finals matchup 👀 Upgrade to unlock Finals Builder."
        );
        return;
      }

      setActiveView("Finals");
      setLoadStatus("idle");
      setLoadMessage("");
      return;
    }

    setActiveView(nextRound);

    if (!isPremium && previewLimitReached && hasLoaded) {
      showPreviewGateAndClear(
        "You’ve used your 2 free Summit previews 👀 Upgrade to switch rounds or load another field."
      );
    } else {
      setLoadStatus("idle");
      setLoadMessage("");
    }
  }

  async function loadDivision() {
    setLoadStatus("idle");
    setLoadMessage("");

    if (!selectedDivision) {
      setLoadStatus("error");
      setLoadMessage("Select a division first.");
      return;
    }

    if (!isPremium && previewLimitReached) {
      showPreviewGateAndClear(
        "You’ve used your 2 free Summit previews 👀 Upgrade to load more divisions, switch rounds, and build your Finals matchup."
      );
      return;
    }

    setLoadStatus("loading");

    const { data, error } = await supabase
      .from("v_championship_entries_resolved")
      .select("team_id, program, team")
      .eq("event_id", SUMMIT_EXPERIENCES.D2_2026.scheduleEventId)
      .eq("division", selectedDivision)
      .eq("round_phase", selectedRound)
      .not("team_id", "is", null)
      .order("program", { ascending: true })
      .order("team", { ascending: true });

    if (error) {
      console.error("Failed to load division:", error);
      setLoadStatus("error");
      setLoadMessage("Could not load this division.");
      return;
    }

    const seen = new Set<string>();
    const nextRoster: TeamOption[] = [];

    for (const row of (data ?? []) as ChampionshipTeamRow[]) {
      const teamId = String(row.team_id ?? "").trim();
      const program = String(row.program ?? "").trim();
      const team = String(row.team ?? "").trim();

      if (!teamId || !team || seen.has(teamId)) continue;
      seen.add(teamId);

      nextRoster.push({
        id: teamId,
        team_id: teamId,
        program,
        team,
        name: program ? `${program} - ${team}` : team,
      });
    }

    if (!nextRoster.length) {
      setLoadStatus("error");
      setLoadMessage("No matched ECS teams found for that selection.");
      return;
    }

    setRoster(nextRoster);
    setLoadedDivision(selectedDivision);
    setLoadedRound(selectedRound);
    setActiveView(selectedRound);
    setPrimaryTeamId(nextRoster[0]?.id ?? "");
    setExpandedTeams([]);

    if (!isPremium) {
      try {
        const nextCount = Math.min(previewCountValue + 1, FREE_PREVIEW_LIMIT);
        window.localStorage.setItem(PREVIEW_COUNT_KEY, String(nextCount));
        setPreviewCount(nextCount);
      } catch {
        // ignore
      }
    }

    setLoadStatus("idle");
  }

  function addFinalist(teamId: string) {
    if (!isPremium) {
      showPreviewGateAndClear(
        "Build your Summit Finals matchup 👀 Upgrade to add teams to Finals."
      );
      return;
    }

    const teamToAdd =
      roster.find((team) => team.id === teamId) ??
      finalistRoster.find((team) => team.id === teamId);

    if (!teamToAdd) return;

    const nextIds = Array.from(new Set([...finalists, teamId]));
    const nextRosterMap = new Map<string, TeamOption>();

    for (const team of finalistRoster) {
      nextRosterMap.set(team.id, team);
    }
    nextRosterMap.set(teamToAdd.id, teamToAdd);

    const nextRoster = Array.from(nextRosterMap.values()).filter((team) =>
      nextIds.includes(team.id)
    );

    setFinalists(nextIds);
    setFinalistRoster(nextRoster);
    saveFinalists(nextIds);
    saveFinalistRoster(nextRoster);
  }

  function removeFinalist(teamId: string) {
    const nextIds = finalists.filter((id) => id !== teamId);
    const nextRoster = finalistRoster.filter((team) => team.id !== teamId);

    setFinalists(nextIds);
    setFinalistRoster(nextRoster);
    saveFinalists(nextIds);
    saveFinalistRoster(nextRoster);
  }

  function clearFinalists() {
    setFinalists([]);
    setFinalistRoster([]);
    saveFinalists([]);
    saveFinalistRoster([]);
  }

  function selectRound(round: RoundPhase) {
    setLoadStatus("idle");
    setLoadMessage("");

    if (!hasLoaded) {
      if (round !== "Finals") {
        setSelectedRound(round);
        setActiveView(round);
      } else {
        showUpgradeMessage("Load a Summit division first, then build your Finals matchup.");
      }
      return;
    }

    if (round === "Finals") {
      if (!isPremium) {
        showPreviewGateAndClear(
          "Build your Summit Finals matchup 👀 Upgrade to use Finals Builder."
        );
        return;
      }

      setActiveView("Finals");
      return;
    }

    if (round !== loadedRound) {
      setSelectedRound(round);
      setActiveView(round);

      if (!isPremium && previewLimitReached) {
        showPreviewGateAndClear(
          "You’ve used your 2 free Summit previews 👀 Upgrade to switch rounds or load another field."
        );
        return;
      }

      showUpgradeMessage("Click Load Division to switch to this round.");
      return;
    }

    setSelectedRound(round);
    setActiveView(round);
  }


  const divisionRounds = availableRoundsByDivision[selectedDivision] ?? [];
  const hasLoaded = roster.length > 0;
  const hasFinalists = finalists.length > 0;

  const postRoundOptions = postRoundsByDivision[selectedPostDivision] ?? [];
  const postChartData = postResults
    .map((row) => ({
      name: `${row.program ?? ""} - ${row.team ?? ""}`,
      teamLabel: row.team ?? "Unknown Team",
      programLabel: row.program ?? "",
      ecsAverage: typeof row.ecs_average === "number" ? row.ecs_average : 0,
      summitScore: typeof row.summit_score === "number" ? row.summit_score : 0,
      rank: row.rank ?? null,
    }))
    .filter((row) => row.ecsAverage > 0 || row.summitScore > 0);

  const postScoreValues = postChartData.flatMap((row) =>
    [
      showPostEcsAverage ? row.ecsAverage : 0,
      showPostSummitScore ? row.summitScore : 0,
    ].filter((value) => value > 0)
  );
  const postScoreDomain: [number, number] = postScoreValues.length
    ? [
        Math.floor((Math.min(...postScoreValues) - 0.5) * 1000) / 1000,
        Math.ceil((Math.max(...postScoreValues) + 0.5) * 1000) / 1000,
      ]
    : [0, 100];

  const activeTitle =
    activeView === "Finals"
      ? `Your Finals (${activeRoster.length} teams)`
      : `${loadedDivision || selectedDivision} — ${activeView}`;

  return (
    <main className={`min-h-screen px-4 py-8 text-white ${selectedExperience.mode === "post" ? "bg-[#120A18]" : "bg-[#0B0F1A]"}`}>
      <div className="mx-auto max-w-[1600px]">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <div className={`text-xs uppercase tracking-[0.24em] ${selectedExperience.mode === "post" ? "text-amber-300" : "text-cyan-300"}`}>
              {selectedExperience.mode === "post" ? "Post-Summit Results" : "Premium Summit Builder"}
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Summit Hub
            </h1>
            <h2 className="text-2xl font-bold">
              {selectedExperience.mode === "post"
                ? "ECS Average vs Summit Results."
                : "Pick a D2 Summit division. ECS builds the field."}
            </h2>
            <p className="text-slate-300 mt-2">
              {selectedExperience.mode === "post"
                ? "Compare regular-season ECS averages against what actually happened at Summit."
                : "Load Wild Card or Prelims instantly. Premium unlocks more divisions, round switching, and Finals Builder."}
            </p>
          </div>

          <div className="flex-1 hidden lg:flex justify-center">
            <div className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500/20 via-teal-400/20 to-cyan-500/20 border border-cyan-300/30 shadow-[0_0_20px_rgba(34,211,238,0.12)] text-sm md:text-base font-semibold text-cyan-100 tracking-wide">
              {primaryBannerText}
            </div>
          </div>
        </div>

        <div className={`mb-4 rounded-2xl border p-4 ${
          selectedExperience.mode === "post"
            ? "border-amber-300/25 bg-[#1A1024]"
            : "border-white/10 bg-[#0E1530]"
        }`}>
          <label className="block text-xs uppercase tracking-[0.2em] text-white/50 mb-2">
            Summit Experience
          </label>
          <select
            value={selectedExperienceKey}
            onChange={(e) => handleExperienceChange(e.target.value as SummitExperienceKey)}
            className="w-full max-w-md rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-amber-300/60"
          >
            {Object.entries(SUMMIT_EXPERIENCES).map(([key, experience]) => (
              <option key={key} value={key} className="bg-[#0B0F1A]">
                {experience.label}
              </option>
            ))}
          </select>
        </div>

        {selectedExperience.mode === "post" ? (
          <section className="space-y-6">
            <div className="rounded-2xl border border-amber-300/25 bg-[#1A1024] p-4 shadow-[0_0_30px_rgba(245,158,11,0.08)]">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3 items-end">
                <div>
                  <label className="block text-xs uppercase tracking-[0.2em] text-amber-100/60 mb-2">
                    Division
                  </label>
                  <select
                    value={selectedPostDivision}
                    onChange={(e) => setSelectedPostDivision(e.target.value)}
                    className="w-full rounded-md bg-black/40 border border-amber-300/20 px-3 py-2 text-sm outline-none focus:border-amber-300/70"
                  >
                    {postDivisions.map((division) => (
                      <option key={division} value={division} className="bg-[#120A18]">
                        {division}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.2em] text-amber-100/60 mb-2">
                    Round
                  </label>
                  <select
                    value={selectedPostRound}
                    onChange={(e) => setSelectedPostRound(e.target.value as RoundPhase)}
                    className="w-full rounded-md bg-black/40 border border-amber-300/20 px-3 py-2 text-sm outline-none focus:border-amber-300/70"
                  >
                    {postRoundOptions.map((round) => (
                      <option key={round} value={round} className="bg-[#120A18]">
                        {round}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {postError && <div className="mt-3 text-sm text-red-300">{postError}</div>}
            </div>

            {!isPremium ? (
              <div className="rounded-2xl border border-amber-300/30 bg-[#1A1024] p-8 text-center shadow-[0_0_30px_rgba(245,158,11,0.10)]">
                <div className="text-xs uppercase tracking-[0.25em] text-amber-300">
                  Premium Feature
                </div>

                <h2 className="mt-3 text-3xl font-bold text-white">
                  See how ECS predicted Summit 👀
                </h2>

                <p className="mx-auto mt-3 max-w-2xl text-sm text-amber-100/70">
                  Compare ECS regular-season averages against actual Summit results across every division and round.
                </p>

                <a
                  href={lockedHref}
                  className="mt-6 inline-flex items-center justify-center rounded-xl border border-amber-300/80 bg-amber-300/15 px-6 py-3 text-sm font-bold text-amber-100 shadow-[0_0_22px_rgba(250,204,21,0.22)] transition-all hover:bg-amber-300/25 hover:shadow-[0_0_30px_rgba(250,204,21,0.38)] active:scale-[0.98]"
                >
                  Unlock Summit Results →
                </a>

                <div className="mt-5 rounded-xl border border-amber-300/15 bg-black/20 p-4 text-left text-xs text-amber-100/65">
                  Premium unlocks the full ECS Average vs Summit Results chart, result table, round filters, and division-by-division proof.
                </div>
              </div>
            ) : (
              <>
            <div className="rounded-2xl border border-amber-300/25 bg-[#1A1024] p-6 shadow-[0_0_30px_rgba(245,158,11,0.08)]">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-amber-300">
                    Championship Proof
                  </div>
                  <h2 className="mt-2 text-2xl font-bold">ECS Average vs Summit Results</h2>
                  <p className="text-sm text-amber-100/65">
                    Gold is the actual Summit result. Dark gray is the ECS regular-season average.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-5 sm:items-start">
                  <div className="flex flex-col items-start">
                    <label className="flex items-center gap-2 text-sm font-semibold text-white">
                      <input
                        type="checkbox"
                        checked={showPostEcsAverage}
                        onChange={(e) => setShowPostEcsAverage(e.target.checked)}
                      />
                      ECS Average
                    </label>
                    <div className="ml-5 mt-2 h-2 w-16 rounded-full border border-white/80 bg-[#3A3A3A]" />
                  </div>

                  <div className="flex flex-col items-start">
                    <label className="flex items-center gap-2 text-sm font-semibold text-white">
                      <input
                        type="checkbox"
                        checked={showPostSummitScore}
                        onChange={(e) => setShowPostSummitScore(e.target.checked)}
                      />
                      Summit Result
                    </label>
                    <div className="ml-5 mt-2 h-2 w-16 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.35)]" />
                  </div>

                  {postLoading && (
                    <div className="text-sm text-amber-100/60">Loading results...</div>
                  )}
                </div>
              </div>

              <div
                className="mt-6 rounded-xl border border-amber-300/15 bg-[#0C0710] p-4"
                style={{ height: `${Math.max(360, postChartData.length * 70)}px` }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={postChartData}
                    layout="vertical"
                    margin={{ top: 8, right: 20, left: 10, bottom: 8 }}
                    barCategoryGap={6}
                  >
                    <CartesianGrid stroke="rgba(245,158,11,0.08)" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={postScoreDomain}
                      tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }}
                      axisLine={{ stroke: "rgba(245,158,11,0.16)" }}
                      tickLine={{ stroke: "rgba(245,158,11,0.16)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={250}
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
                              fill="rgba(255,255,255,0.70)"
                              fontSize="11"
                            >
                              {program}
                            </text>
                            {team && (
                              <text
                                x={-10}
                                y={12}
                                textAnchor="end"
                                fill="rgba(255,255,255,0.95)"
                                fontSize="12"
                                fontWeight="700"
                              >
                                {team}
                              </text>
                            )}
                          </g>
                        );
                      }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      content={<PostSummitTooltip />}
                    />
                    {showPostEcsAverage && (
                      <Bar
                        dataKey="ecsAverage"
                        fill="#3A3A3A"
                        stroke="#f5f5f5"
                        strokeWidth={1}
                        radius={[0, 6, 6, 0]}
                      />
                    )}
                    {showPostSummitScore && (
                      <Bar dataKey="summitScore" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-300/25 bg-[#1A1024] p-6 shadow-[0_0_30px_rgba(245,158,11,0.08)]">
              <h2 className="text-xl font-semibold">Results Detail</h2>
              <p className="text-sm text-amber-100/65">
                Sorted by actual Summit rank.
              </p>

              <div className="mt-6 overflow-x-auto rounded-xl border border-amber-300/15 bg-[#0C0710]">
                <table className="min-w-full text-sm">
                  <thead className="bg-amber-300/10 text-amber-100/80">
                    <tr>
                      <th className="px-4 py-3 text-left">Rank</th>
                      <th className="px-4 py-3 text-left">Program</th>
                      <th className="px-4 py-3 text-left">Team</th>
                      <th className="px-4 py-3 text-left">ECS Average</th>
                      <th className="px-4 py-3 text-left">Summit Result</th>
                      <th className="px-4 py-3 text-left">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {postResults.map((row, index) => {
                      const delta =
                        typeof row.score_delta === "number" ? row.score_delta : null;

                      return (
                        <tr
                          key={`${row.team_id ?? row.program}-${row.team}-${index}`}
                          className="border-t border-amber-300/10 hover:bg-amber-300/5"
                        >
                          <td className="px-4 py-3 font-bold text-amber-300">
                            {row.rank ?? "--"}
                          </td>
                          <td className="px-4 py-3 text-white/80">{row.program ?? "--"}</td>
                          <td className="px-4 py-3 font-semibold text-white">{row.team ?? "--"}</td>
                          <td className="px-4 py-3 text-white">
                            {typeof row.ecs_average === "number"
                              ? row.ecs_average.toFixed(3)
                              : "No ECS data"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-amber-300">
                            {typeof row.summit_score === "number"
                              ? row.summit_score.toFixed(3)
                              : "--"}
                          </td>
                          <td
                            className={`px-4 py-3 font-semibold ${
                              delta == null
                                ? "text-white/50"
                                : delta >= 0
                                  ? "text-emerald-300"
                                  : "text-red-300"
                            }`}
                          >
                            {delta == null ? "--" : delta >= 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {!postLoading && postResults.length === 0 && (
                  <div className="p-6 text-center text-amber-100/60">
                    No results found for this division and round.
                  </div>
                )}
              </div>
            </div>
              </>
            )}
          </section>
        ) : (
          <>
        <div className="mb-6 rounded-2xl border border-white/10 bg-[#0E1530] p-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px_180px] gap-3 items-end">
            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-white/50 mb-2">
                Division
              </label>
              <select
                value={selectedDivision}
                onChange={(e) => handleDivisionChange(e.target.value)}
                disabled={optionsLoading}
                className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-teal-400/50"
              >
                {availableDivisions.map((division) => (
                  <option key={division} value={division} className="bg-[#0B0F1A]">
                    {division}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-white/50 mb-2">
                Round
              </label>
              <select
                value={selectedRound}
                onChange={(e) => handleRoundDropdownChange(e.target.value as RoundPhase)}
                disabled={optionsLoading}
                className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-teal-400/50"
              >
                {[...divisionRounds, "Finals"].map((round) => (
                  <option key={round} value={round} className="bg-[#0B0F1A]">
                    {round}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={loadDivision}
              disabled={loadStatus === "loading" || optionsLoading || premiumLoading}
              className="mx-auto mt-4 flex w-full max-w-sm items-center justify-center rounded-xl border border-cyan-300/70 bg-cyan-400/15 px-6 py-3 text-sm font-bold text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.22)] transition-all hover:bg-cyan-400/25 hover:shadow-[0_0_30px_rgba(34,211,238,0.38)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadStatus === "loading" ? "Loading..." : "Load My Summit Division →"}
            </button>
          </div>

          {optionsError && (
            <div className="mt-3 text-sm text-red-300">{optionsError}</div>
          )}

          {loadMessage && (
            <div className="mt-4 rounded-2xl border border-amber-300/35 bg-[#15172A] p-5 text-sm text-amber-50 shadow-[0_0_30px_rgba(250,204,21,0.12)]">
              <div className="text-base font-semibold">{loadMessage}</div>
              {!isPremium && (
                <a
                  href={lockedHref}
                  className="mt-4 inline-flex items-center justify-center rounded-xl border border-amber-300/80 bg-amber-300/15 px-6 py-3 text-sm font-bold text-amber-100 shadow-[0_0_22px_rgba(250,204,21,0.22)] transition-all hover:bg-amber-300/25 hover:shadow-[0_0_30px_rgba(250,204,21,0.38)] active:scale-[0.98]"
                >
                  Unlock Full Summit Access →
                </a>
              )}
            </div>
          )}

          {!isPremium && !previewLimitReached && (
            <div className="mt-3 text-xs text-slate-400">
              Free previews: {previewCountValue}/{FREE_PREVIEW_LIMIT} used. Load up to 2 Summit divisions/rounds. Finals Builder requires Premium.
            </div>
          )}

          {!isPremium && previewLimitReached && (
            <div className="mt-3 text-xs text-slate-400">
              Free previews used. Upgrade to load more divisions, switch rounds, or build Finals.
            </div>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {(["Wild Card", "Prelims"] as RoundPhase[]).map((round) => (
            <button
              key={round}
              onClick={() => selectRound(round)}
              disabled={false}
              className={`rounded-xl px-4 py-2 text-sm font-semibold border ${
                activeView === round
                  ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30"
              }`}
            >
              {round}
            </button>
          ))}

          <button
            onClick={() => selectRound("Finals")}
            disabled={false}
            className={`rounded-xl px-4 py-2 text-sm font-semibold border ${
              activeView === "Finals"
                ? "border-fuchsia-300/50 bg-fuchsia-300/15 text-fuchsia-100"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30"
            }`}
          >
            Finals {finalists.length ? `(${finalists.length})` : ""}
          </button>

          {isPremium && finalists.length > 0 && (
            <button
              onClick={clearFinalists}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
            >
              Clear Finals
            </button>
          )}
        </div>

        {!hasLoaded ? (
          <div className="rounded-2xl border border-white/10 bg-[#08122A] p-8 text-center">
            <div className="text-2xl font-bold">Select a division to start.</div>
            <p className="mt-2 text-slate-300">
              ECS will preload the full D2 Summit field for that round.
            </p>
          </div>
        ) : activeView === "Finals" && !hasFinalists ? (
          <div className="rounded-2xl border border-white/10 bg-[#08122A] p-8 text-center">
            <div className="text-2xl font-bold">No finalists selected yet.</div>
            <p className="mt-2 text-slate-300">
              Go back to Wild Card or Prelims and add teams to your Finals.
            </p>
          </div>
        ) : (
          <>
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

            <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
              <aside className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{activeTitle}</h2>
                    <p className="mt-1 text-xs text-white/50">
                      {activeRoster.length} teams loaded
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 max-h-[700px] overflow-auto pr-1">
                  {activeRoster.map((team) => {
                    const isPrimary = primaryTeamId === team.id;
                    const inFinals = finalists.includes(team.id);

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
                          <div>
                            <div className="text-xs text-white/50">{team.program}</div>
                            <div className="text-sm font-medium">{team.team}</div>
                          </div>
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

                          {activeView !== "Finals" ? (
                            <button
                              onClick={() => addFinalist(team.id)}
                              className={`rounded-md px-2 py-1 text-xs ${
                                inFinals
                                  ? "bg-fuchsia-400/20 text-fuchsia-100 border border-fuchsia-300/30"
                                  : "border border-white/10 hover:bg-white/10"
                              }`}
                            >
                              {inFinals ? "✓ In Finals" : "+ Add to Finals"}
                            </button>
                          ) : (
                            <button
                              onClick={() => removeFinalist(team.id)}
                              className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/10"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </aside>

              <section className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-[#08122A] p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">Summit Dashboard</h2>
                      <p className="text-sm text-white/60">
                        ECS season data applied to the loaded Summit field.
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
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(255,255,255,0.04)" }}
                          contentStyle={{
                            background: "#020617",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 12,
                            color: "#fff",
                          }}
                          formatter={(value: any, name: any) => [
                            typeof value === "number" ? value.toFixed(3) : value,
                            name === "avgScore" ? "Avg Event" : "Avg Ceiling",
                          ]}
                          labelFormatter={(label) => String(label)}
                        />

                        {showBarScore && (
                          <Bar dataKey="avgScore" fill="#22d3ee" radius={[0, 6, 6, 0]} />
                        )}

                        {showBarCeiling && (
                          <Bar dataKey="ceiling" fill="#f472b6" radius={[0, 6, 6, 0]} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#08122A] p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">Summit Comp Data</h2>
                      <p className="text-sm text-white/60">
                        Click each team to drill down into event-level data.
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
                                    <span className="font-medium text-white">
                                      {row.team}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-4 py-3 text-cyan-300">
                                  {row.avgScore ? row.avgScore.toFixed(3) : "No ECS data"}
                                </td>

                                <td className="px-4 py-3 text-pink-300">
                                  {row.ceiling ? row.ceiling.toFixed(3) : "No ECS data"}
                                </td>

                                <td className="px-4 py-3 text-emerald-300">
                                  {row.hitZeroRate ? Math.round(row.hitZeroRate) + "%" : "No ECS data"}
                                </td>

                                <td className="px-4 py-3 text-white/80">
                                  {row.lastCompDate ? formatDate(row.lastCompDate) : "No ECS data"}
                                </td>

                                <td className="px-4 py-3 text-amber-300">
                                  {row.lastCompScore ? row.lastCompScore.toFixed(3) : "No ECS data"}
                                </td>
                              </tr>

                              {expanded && (
                                <tr className="border-t border-white/10 bg-white/[0.03]">
                                  <td colSpan={6} className="px-4 py-4">
                                    <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/20">
                                      <table className="min-w-full text-xs">
                                        <thead className="bg-white/5 text-white/60">
                                          <tr>
                                            <th className="px-3 py-2 text-left">
                                              Event Name
                                            </th>
                                            <th className="px-3 py-2 text-left">
                                              Event Date
                                            </th>
                                            <th className="px-3 py-2 text-left">
                                              Event Score
                                            </th>
                                            <th className="px-3 py-2 text-left">
                                              Event Ceiling Score
                                            </th>
                                          </tr>
                                        </thead>

                                        <tbody>
                                          {row.comps.map((comp) => (
                                            <tr
                                              key={comp.id}
                                              className="border-t border-white/10"
                                            >
                                              <td className="px-3 py-2 text-white/85">
                                                {comp.eventName}
                                              </td>
                                              <td className="px-3 py-2 text-white/70">
                                                {formatDate(comp.eventDate)}
                                              </td>
                                              <td className="px-3 py-2 text-cyan-300">
                                                {comp.eventScore != null
                                                  ? comp.eventScore.toFixed(3)
                                                  : "No ECS data"}
                                              </td>
                                              <td className="px-3 py-2 text-pink-300">
                                                {comp.eventCeilingScore != null
                                                  ? comp.eventCeilingScore.toFixed(3)
                                                  : "No ECS data"}
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
              </section>
            </div>
          </>
        )}
          </>
        )}
      </div>
    </main>
  );
}
