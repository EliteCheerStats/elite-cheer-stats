"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";

type TeamOption = {
  team_id: string;
  program: string | null;
  team: string | null;
  division: string | null;
};

type EventRow = {
  team_id: string;
  program: string | null;
  team: string | null;
  event_id: string;
  event_name: string | null;
  weekend_date: string | null;
  division: string | null;
  event_score: number | null;
};

type CeilingRow = {
  team_id: string;
  event_id: string;
  ceiling_score: number | null;
  ceiling_delta: number | null;
  ceiling_method: string | null;
  ceiling_supported: boolean | null;
  round_count: number | null;
};

type PerfRow = {
  team_id: string;
  event_id: string;
  weekend_date: string | null;
  round: string | null;
  round_raw: string | null;
  round_phase: string | null;
  deductions: number | null;
};

type TeamStats = {
  avgScore: number | null;
  avgCeiling: number | null;
  hitZeroRate: number;
  hitZeroHits: number;
  hitZeroTotal: number;
  eventCount: number;
};

type TeamSeriesPoint = {
  event_id: string;
  event_name: string;
  weekend_date: string;
  event_score: number | null;
  ceiling_score: number | null;
};

type VerdictTone = "clear" | "slight" | "split" | "close" | "neutral";

type VerdictBlock = {
  tone: VerdictTone;
  headline: string;
  bullets: Array<{
    icon: string;
    text: string;
  }>;
  verdict: string;
};

const RED = "#ef4444";
const BLUE = "#3b82f6";
const CEILING_A = "#facc15";
const CEILING_B = "#a855f7";

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function avg(nums: Array<number | null | undefined>): number | null {
  const clean = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (!clean.length) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

function fmt3(n: number | null | undefined) {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(3) : "—";
}

function fmtPct(n: number | null | undefined) {
  return typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
}

function sameDateLabel(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function computeHitRate(rows: PerfRow[]) {
  let hits = 0;
  let total = 0;

  for (const r of rows) {
    if (r.deductions === null || r.deductions === undefined) continue;

    const ded = Number(r.deductions);
    if (!Number.isFinite(ded)) continue;

    total += 1;
    if (Math.abs(ded) < 0.0001) hits += 1;
  }

  return {
    hits,
    total,
    pct: total ? (hits / total) * 100 : 0,
  };
}

function mergeSeries(
  aLabel: string,
  bLabel: string,
  aRows: TeamSeriesPoint[],
  bRows: TeamSeriesPoint[]
) {
  const map = new Map<string, Record<string, string | number | null>>();

  for (const r of aRows) {
    const key = r.weekend_date;

    const existing = map.get(key) ?? {
      weekend_date: r.weekend_date,
      date_label: sameDateLabel(r.weekend_date),
      [`${aLabel}_event_name`]: null,
      [`${bLabel}_event_name`]: null,
      [`${aLabel}_score`]: null,
      [`${aLabel}_ceiling`]: null,
      [`${bLabel}_score`]: null,
      [`${bLabel}_ceiling`]: null,
    };

    existing[`${aLabel}_event_name`] = r.event_name;
    existing[`${aLabel}_score`] = r.event_score;
    existing[`${aLabel}_ceiling`] = r.ceiling_score;

    map.set(key, existing);
  }

  for (const r of bRows) {
    const key = r.weekend_date;

    const existing = map.get(key) ?? {
      weekend_date: r.weekend_date,
      date_label: sameDateLabel(r.weekend_date),
      [`${aLabel}_event_name`]: null,
      [`${bLabel}_event_name`]: null,
      [`${aLabel}_score`]: null,
      [`${aLabel}_ceiling`]: null,
      [`${bLabel}_score`]: null,
      [`${bLabel}_ceiling`]: null,
    };

    existing[`${bLabel}_event_name`] = r.event_name;
    existing[`${bLabel}_score`] = r.event_score;
    existing[`${bLabel}_ceiling`] = r.ceiling_score;

    map.set(key, existing);
  }

  return Array.from(map.values()).sort((x, y) => {
    const dx = String(x.weekend_date ?? "");
    const dy = String(y.weekend_date ?? "");
    return dx.localeCompare(dy);
  });
}

function buildTeamName(opt: TeamOption | null) {
  if (!opt) return "Select a team";
  return [opt.program, opt.team].filter(Boolean).join(" • ");
}

function buildFullTeamLabel(opt: TeamOption | null) {
  if (!opt) return "Select a team";
  const name = buildTeamName(opt);
  return opt.division ? `${name} (${opt.division})` : name;
}

function safeGap(a: number | null, b: number | null) {
  if (a === null || b === null) return null;
  return a - b;
}

function absGapLabel(gap: number | null, digits = 3) {
  if (gap === null) return "—";
  return `${Math.abs(gap).toFixed(digits)}`;
}

function searchPlaceholder(side: "A" | "B") {
  return side === "A"
    ? "Search Team A: program or team"
    : "Search Team B: program or team";
}

function getLeader(
  a: number | null,
  b: number | null,
  tieThreshold = 0.0005
): "A" | "B" | null {
  if (a === null || b === null) return null;
  if (Math.abs(a - b) < tieThreshold) return null;
  return a > b ? "A" : "B";
}

function getLeaderName(
  leader: "A" | "B" | null,
  teamAName: string,
  teamBName: string
) {
  if (leader === "A") return teamAName;
  if (leader === "B") return teamBName;
  return null;
}

function getTrailingName(
  leader: "A" | "B" | null,
  teamAName: string,
  teamBName: string
) {
  if (leader === "A") return teamBName;
  if (leader === "B") return teamAName;
  return null;
}

function titleCaseVerdict(text: string) {
  return text;
}

function buildComparisonVerdict(params: {
  ready: boolean;
  isPremium: boolean;
  teamAName: string;
  teamBName: string;
  avgScoreGap: number | null;
  avgCeilingGap: number | null;
  hitRateGap: number | null;
  avgScoreLeader: "A" | "B" | null;
  avgCeilingLeader: "A" | "B" | null;
  hitRateLeader: "A" | "B" | null;
}): VerdictBlock {
  const {
    ready,
    isPremium,
    teamAName,
    teamBName,
    avgScoreGap,
    avgCeilingGap,
    hitRateGap,
    avgScoreLeader,
    avgCeilingLeader,
    hitRateLeader,
  } = params;

  if (!ready) {
    return {
      tone: "neutral",
      headline: "Compare any two teams side-by-side before they compete.",
      bullets: [
        { icon: "🏆", text: "See who leads on average score" },
        { icon: "🎯", text: "See who has more scoring upside" },
        { icon: "🔥", text: "See who has been steadier across performances" },
      ],
      verdict: "VERDICT: Select two teams to compare",
    };
  }

  if (avgScoreGap === null) {
    return {
      tone: "neutral",
      headline: "Compare score, ceiling, and consistency to see where each team stands.",
      bullets: [
        { icon: "🏆", text: "Average score shows who is ahead right now" },
        {
          icon: "🎯",
          text: isPremium
            ? "Ceiling shows who has more scoring upside"
            : "Unlock ceiling to see who has more scoring upside",
        },
        {
          icon: "🔥",
          text: isPremium
            ? "Consistency shows who has had the steadier path"
            : "Unlock consistency to see who has had the steadier path",
        },
      ],
      verdict: "VERDICT: Need both teams loaded",
    };
  }

  const avgLeaderName = getLeaderName(avgScoreLeader, teamAName, teamBName);
  const avgTrailName = getTrailingName(avgScoreLeader, teamAName, teamBName);
  const ceilingLeaderName = getLeaderName(avgCeilingLeader, teamAName, teamBName);
  const hitLeaderName = getLeaderName(hitRateLeader, teamAName, teamBName);

  const avgAbs = Math.abs(avgScoreGap);
  const ceilingAbs = avgCeilingGap === null ? null : Math.abs(avgCeilingGap);
  const hitAbs = hitRateGap === null ? null : Math.abs(hitRateGap);

  const bullets: VerdictBlock["bullets"] = [];

  if (avgLeaderName) {
    bullets.push({
      icon: "🏆",
      text: `${avgLeaderName} leads average score by ${avgAbs.toFixed(3)}`,
    });
  }

  if (isPremium) {
    if (ceilingLeaderName && ceilingAbs !== null && ceilingAbs >= 0.05) {
      bullets.push({
        icon: "🎯",
        text: `${ceilingLeaderName} has the higher ceiling by ${ceilingAbs.toFixed(3)}`,
      });
    } else {
      bullets.push({
        icon: "🎯",
        text: "Ceiling is basically even",
      });
    }

    if (hitLeaderName && hitAbs !== null && hitAbs >= 0.25) {
      bullets.push({
        icon: "🔥",
        text: `${hitLeaderName} has been more consistent`,
      });
    } else {
      bullets.push({
        icon: "🔥",
        text: "Consistency is very close",
      });
    }
  } else {
    bullets.push({
      icon: "🎯",
      text: "Unlock ceiling to see which team has more upside",
    });
    bullets.push({
      icon: "🔥",
      text: "Unlock consistency to see which team has been steadier",
    });
  }

  const scoreOnlyTone =
    avgAbs < 0.2 ? "close" : avgAbs < 0.5 ? "slight" : "clear";

  if (!isPremium) {
    if (!avgLeaderName || !avgTrailName) {
      return {
        tone: "neutral",
        headline: "Compare score, ceiling, and consistency to see where each team stands.",
        bullets,
        verdict: "VERDICT: Need both teams loaded",
      };
    }

    if (scoreOnlyTone === "close") {
      return {
        tone: "close",
        headline: "These teams are very close on average score right now.",
        bullets,
        verdict: "VERDICT: This matchup looks tight",
      };
    }

    if (scoreOnlyTone === "slight") {
      return {
        tone: "slight",
        headline: `${avgLeaderName} has a slight edge over ${avgTrailName} right now.`,
        bullets,
        verdict: `VERDICT: ${titleCaseVerdict(avgLeaderName)} has a slight edge`,
      };
    }

    return {
      tone: "clear",
      headline: `${avgLeaderName} has a clear edge over ${avgTrailName} right now.`,
      bullets,
      verdict: `VERDICT: ${titleCaseVerdict(avgLeaderName)} is favored`,
    };
  }

  const leaders = [avgScoreLeader, avgCeilingLeader, hitRateLeader].filter(Boolean);
  const countA = leaders.filter((x) => x === "A").length;
  const countB = leaders.filter((x) => x === "B").length;

  const dominantLeader = countA > countB ? "A" : countB > countA ? "B" : null;
  const dominantLeaderName = getLeaderName(dominantLeader, teamAName, teamBName);
  const dominantTrailName = getTrailingName(dominantLeader, teamAName, teamBName);

  const allSameLeader =
    avgScoreLeader &&
    avgCeilingLeader &&
    hitRateLeader &&
    avgScoreLeader === avgCeilingLeader &&
    avgScoreLeader === hitRateLeader;

  const splitScoreVsCeiling =
    avgScoreLeader &&
    avgCeilingLeader &&
    avgScoreLeader !== avgCeilingLeader;

  const scoreAndConsistencyAligned =
    avgScoreLeader &&
    hitRateLeader &&
    avgScoreLeader === hitRateLeader;

  const scoreAndCeilingAligned =
    avgScoreLeader &&
    avgCeilingLeader &&
    avgScoreLeader === avgCeilingLeader;

  const avgMeaningful = avgAbs >= 0.2;
  const ceilingMeaningful = ceilingAbs !== null && ceilingAbs >= 0.15;
  const hitMeaningful = hitAbs !== null && hitAbs >= 2.5;

  if (allSameLeader && dominantLeaderName && dominantTrailName) {
    const tone: VerdictTone = avgAbs >= 0.5 ? "clear" : "slight";

    return {
      tone,
      headline:
        tone === "clear"
          ? `${dominantLeaderName} has a clear edge over ${dominantTrailName} right now.`
          : `${dominantLeaderName} has the edge over ${dominantTrailName} right now.`,
      bullets,
      verdict:
        tone === "clear"
          ? `VERDICT: ${titleCaseVerdict(dominantLeaderName)} is favored`
          : `VERDICT: ${titleCaseVerdict(dominantLeaderName)} has the edge`,
    };
  }

  if (
    splitScoreVsCeiling &&
    avgLeaderName &&
    ceilingLeaderName &&
    scoreAndConsistencyAligned &&
    avgLeaderName === hitLeaderName
  ) {
    return {
      tone: "split",
      headline: `${avgLeaderName} leads right now, but ${ceilingLeaderName} has the higher ceiling.`,
      bullets,
      verdict: `VERDICT: ${titleCaseVerdict(avgLeaderName)} is safer right now, but ${titleCaseVerdict(
        ceilingLeaderName
      )} has more upside`,
    };
  }

  if (scoreAndCeilingAligned && avgLeaderName && dominantTrailName) {
    return {
      tone: avgMeaningful || ceilingMeaningful ? "clear" : "slight",
      headline: `${avgLeaderName} has the stronger scoring profile right now.`,
      bullets,
      verdict: hitMeaningful
        ? `VERDICT: ${titleCaseVerdict(avgLeaderName)} is favored`
        : `VERDICT: ${titleCaseVerdict(avgLeaderName)} has the edge`,
    };
  }

  if (dominantLeaderName && dominantTrailName && (countA === 2 || countB === 2)) {
    return {
      tone: "slight",
      headline: `${dominantLeaderName} holds the edge overall, but this matchup has some split signals.`,
      bullets,
      verdict: `VERDICT: ${titleCaseVerdict(dominantLeaderName)} has a slight edge`,
    };
  }

  return {
    tone: "close",
    headline: "This matchup is tighter than it looks.",
    bullets,
    verdict: "VERDICT: Too close to call cleanly",
  };
}

export default function ComparePage() {
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [optionsA, setOptionsA] = useState<TeamOption[]>([]);
  const [optionsB, setOptionsB] = useState<TeamOption[]>([]);
  const [teamA, setTeamA] = useState<TeamOption | null>(null);
  const [teamB, setTeamB] = useState<TeamOption | null>(null);

  const [eventsA, setEventsA] = useState<EventRow[]>([]);
  const [eventsB, setEventsB] = useState<EventRow[]>([]);
  const [ceilingsA, setCeilingsA] = useState<Map<string, CeilingRow>>(new Map());
  const [ceilingsB, setCeilingsB] = useState<Map<string, CeilingRow>>(new Map());
  const [perfA, setPerfA] = useState<PerfRow[]>([]);
  const [perfB, setPerfB] = useState<PerfRow[]>([]);

  const [showCeiling, setShowCeiling] = useState(false);
  const [showScore, setShowScore] = useState(true);

  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [searchingA, setSearchingA] = useState(false);
  const [searchingB, setSearchingB] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [premiumLoading, setPremiumLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [session, setSession] = useState<any>(null);

  const teamAName = buildTeamName(teamA);
  const teamBName = buildTeamName(teamB);

  const lockedHref = session?.user ? "/upgrade" : "/login";
  const lockedCtaLabel = session?.user ? "Upgrade to Premium" : "Create Account";

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
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("comparison premium check error:", error);
        setIsPremium(false);
        setPremiumLoading(false);
        return;
      }

      setIsPremium(!!data?.is_premium);
      setPremiumLoading(false);
    }

    checkPremium();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      checkPremium();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isPremium && showCeiling) {
      setShowCeiling(false);
    }
  }, [isPremium, showCeiling]);

  useEffect(() => {
    const q = searchA.trim();
    if (q.length < 2) {
      setOptionsA([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearchingA(true);
        setError(null);

        const safe = q.replace(/,/g, " ").trim();

        const { data, error } = await supabase
          .from("v_team_event_scores")
          .select("team_id, program, team, division")
          .or(`team.ilike.%${safe}%,program.ilike.%${safe}%`)
          .limit(100);

        if (error) throw error;
        if (cancelled) return;

        const seen = new Set<string>();
        const unique = (data ?? []).filter((r: any) => {
          const key = String(r.team_id);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        unique.sort((a: any, b: any) => {
          const aName = [a.program, a.team].filter(Boolean).join(" ").toLowerCase();
          const bName = [b.program, b.team].filter(Boolean).join(" ").toLowerCase();
          return aName.localeCompare(bName);
        });

        setOptionsA(unique as TeamOption[]);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to search Team A");
      } finally {
        if (!cancelled) setSearchingA(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchA]);

  useEffect(() => {
    const q = searchB.trim();
    if (q.length < 2) {
      setOptionsB([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearchingB(true);
        setError(null);

        const safe = q.replace(/,/g, " ").trim();

        const { data, error } = await supabase
          .from("v_team_event_scores")
          .select("team_id, program, team, division")
          .or(`team.ilike.%${safe}%,program.ilike.%${safe}%`)
          .limit(100);

        if (error) throw error;
        if (cancelled) return;

        const seen = new Set<string>();
        const unique = (data ?? []).filter((r: any) => {
          const key = String(r.team_id);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        unique.sort((a: any, b: any) => {
          const aName = [a.program, a.team].filter(Boolean).join(" ").toLowerCase();
          const bName = [b.program, b.team].filter(Boolean).join(" ").toLowerCase();
          return aName.localeCompare(bName);
        });

        setOptionsB(unique as TeamOption[]);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to search Team B");
      } finally {
        if (!cancelled) setSearchingB(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchB]);

  useEffect(() => {
    if (!teamA?.team_id) {
      setEventsA([]);
      setCeilingsA(new Map());
      setPerfA([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingA(true);
        setError(null);

        const { data: scoreData, error: scoreErr } = await supabase
          .from("v_team_event_scores")
          .select("team_id, program, team, event_id, event_name, weekend_date, division, event_score")
          .eq("team_id", teamA.team_id)
          .order("weekend_date", { ascending: true });

        if (scoreErr) throw scoreErr;
        if (cancelled) return;

        const scoreRows = (scoreData ?? []) as EventRow[];
        setEventsA(scoreRows);

        const eventIds = Array.from(new Set(scoreRows.map((r) => String(r.event_id)).filter(Boolean)));

        const [ceilingRes, perfRes] = await Promise.all([
          eventIds.length
            ? supabase
                .from("mv_team_event_ceiling_rebuilt")
                .select("team_id, event_id, ceiling_score, ceiling_delta, ceiling_method, ceiling_supported, round_count")
                .in("event_id", eventIds)
                .eq("team_id", teamA.team_id)
            : Promise.resolve({ data: [], error: null } as any),
          supabase
            .from("v_results_normalized")
            .select("team_id, event_id, weekend_date, round, round_raw, round_phase, deductions")
            .eq("team_id", teamA.team_id)
            .in("round_phase", ["Prelims", "Finals"])
            .order("weekend_date", { ascending: true }),
        ]);

        if (ceilingRes.error) throw ceilingRes.error;
        if (perfRes.error) throw perfRes.error;
        if (cancelled) return;

        const ceilingMap = new Map<string, CeilingRow>();
        for (const row of (ceilingRes.data ?? []) as CeilingRow[]) {
          ceilingMap.set(String(row.event_id), row);
        }

        setCeilingsA(ceilingMap);
        setPerfA((perfRes.data ?? []) as PerfRow[]);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to load Team A");
      } finally {
        if (!cancelled) setLoadingA(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [teamA]);

  useEffect(() => {
    if (!teamB?.team_id) {
      setEventsB([]);
      setCeilingsB(new Map());
      setPerfB([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingB(true);
        setError(null);

        const { data: scoreData, error: scoreErr } = await supabase
          .from("v_team_event_scores")
          .select("team_id, program, team, event_id, event_name, weekend_date, division, event_score")
          .eq("team_id", teamB.team_id)
          .order("weekend_date", { ascending: true });

        if (scoreErr) throw scoreErr;
        if (cancelled) return;

        const scoreRows = (scoreData ?? []) as EventRow[];
        setEventsB(scoreRows);

        const eventIds = Array.from(new Set(scoreRows.map((r) => String(r.event_id)).filter(Boolean)));

        const [ceilingRes, perfRes] = await Promise.all([
          eventIds.length
            ? supabase
                .from("mv_team_event_ceiling_rebuilt")
                .select("team_id, event_id, ceiling_score, ceiling_delta, ceiling_method, ceiling_supported, round_count")
                .in("event_id", eventIds)
                .eq("team_id", teamB.team_id)
            : Promise.resolve({ data: [], error: null } as any),
          supabase
            .from("v_results_normalized")
            .select("team_id, event_id, weekend_date, round, round_raw, round_phase, deductions")
            .eq("team_id", teamB.team_id)
            .in("round_phase", ["Prelims", "Finals"])
            .order("weekend_date", { ascending: true }),
        ]);

        if (ceilingRes.error) throw ceilingRes.error;
        if (perfRes.error) throw perfRes.error;
        if (cancelled) return;

        const ceilingMap = new Map<string, CeilingRow>();
        for (const row of (ceilingRes.data ?? []) as CeilingRow[]) {
          ceilingMap.set(String(row.event_id), row);
        }

        setCeilingsB(ceilingMap);
        setPerfB((perfRes.data ?? []) as PerfRow[]);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to load Team B");
      } finally {
        if (!cancelled) setLoadingB(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [teamB]);

  const seriesA = useMemo<TeamSeriesPoint[]>(() => {
    return eventsA.map((r) => ({
      event_id: String(r.event_id),
      event_name: r.event_name ?? String(r.event_id),
      weekend_date: r.weekend_date ?? "",
      event_score: toNum(r.event_score),
      ceiling_score: toNum(ceilingsA.get(String(r.event_id))?.ceiling_score),
    }));
  }, [eventsA, ceilingsA]);

  const seriesB = useMemo<TeamSeriesPoint[]>(() => {
    return eventsB.map((r) => ({
      event_id: String(r.event_id),
      event_name: r.event_name ?? String(r.event_id),
      weekend_date: r.weekend_date ?? "",
      event_score: toNum(r.event_score),
      ceiling_score: toNum(ceilingsB.get(String(r.event_id))?.ceiling_score),
    }));
  }, [eventsB, ceilingsB]);

  const statsA = useMemo<TeamStats>(() => {
    const hitRate = computeHitRate(perfA);
    return {
      avgScore: avg(eventsA.map((r) => toNum(r.event_score))),
      avgCeiling: avg(seriesA.map((r) => r.ceiling_score)),
      hitZeroRate: hitRate.pct,
      hitZeroHits: hitRate.hits,
      hitZeroTotal: hitRate.total,
      eventCount: eventsA.length,
    };
  }, [eventsA, perfA, seriesA]);

  const statsB = useMemo<TeamStats>(() => {
    const hitRate = computeHitRate(perfB);
    return {
      avgScore: avg(eventsB.map((r) => toNum(r.event_score))),
      avgCeiling: avg(seriesB.map((r) => r.ceiling_score)),
      hitZeroRate: hitRate.pct,
      hitZeroHits: hitRate.hits,
      hitZeroTotal: hitRate.total,
      eventCount: eventsB.length,
    };
  }, [eventsB, perfB, seriesB]);

  const chartData = useMemo(() => {
    if (!teamA || !teamB) return [];
    return mergeSeries("teamA", "teamB", seriesA, seriesB);
  }, [teamA, teamB, seriesA, seriesB]);

  const ready = !!teamA && !!teamB;

  const firstDate = chartData[0]?.weekend_date;
  const lastDate = chartData[chartData.length - 1]?.weekend_date;

  const seasonLabel =
    firstDate && lastDate
      ? `${new Date(firstDate).toLocaleString("default", { month: "short" })} → ${new Date(
          lastDate
        ).toLocaleString("default", { month: "short" })}`
      : "";

  const avgScoreGap = safeGap(statsA.avgScore, statsB.avgScore);
  const avgCeilingGap = safeGap(statsA.avgCeiling, statsB.avgCeiling);
  const hitRateGap =
    statsA.hitZeroTotal > 0 && statsB.hitZeroTotal > 0
      ? safeGap(statsA.hitZeroRate, statsB.hitZeroRate)
      : null;

  const avgScoreLeader = getLeader(statsA.avgScore, statsB.avgScore);
  const avgCeilingLeader = getLeader(statsA.avgCeiling, statsB.avgCeiling, 0.05);
  const hitRateLeader =
    statsA.hitZeroTotal > 0 && statsB.hitZeroTotal > 0
      ? getLeader(statsA.hitZeroRate, statsB.hitZeroRate, 0.25)
      : null;

  const avgScoreLeaderName = getLeaderName(avgScoreLeader, teamAName, teamBName);
  const avgScoreTrailingName = getTrailingName(avgScoreLeader, teamAName, teamBName);
  const avgCeilingLeaderName = getLeaderName(avgCeilingLeader, teamAName, teamBName);
  const hitRateLeaderName = getLeaderName(hitRateLeader, teamAName, teamBName);

  const verdictBlock = useMemo(
    () =>
      buildComparisonVerdict({
        ready,
        isPremium,
        teamAName,
        teamBName,
        avgScoreGap,
        avgCeilingGap,
        hitRateGap,
        avgScoreLeader,
        avgCeilingLeader,
        hitRateLeader,
      }),
    [
      ready,
      isPremium,
      teamAName,
      teamBName,
      avgScoreGap,
      avgCeilingGap,
      hitRateGap,
      avgScoreLeader,
      avgCeilingLeader,
      hitRateLeader,
    ]
  );

  const insightCards = useMemo(() => {
    const avgEdge =
      avgScoreGap === null ? "—" : `${absGapLabel(avgScoreGap, 3)} pts`;

    const avgDetail =
      avgScoreLeaderName && avgScoreTrailingName && avgScoreGap !== null
        ? `${avgScoreTrailingName} trails ${avgScoreLeaderName} by ${absGapLabel(avgScoreGap, 3)}.`
        : "Select both teams to compare.";

    const ceilingEdge = !isPremium
      ? "Unlock"
      : avgCeilingGap !== null
      ? `${absGapLabel(avgCeilingGap, 3)} pts`
      : "—";

    const ceilingDetail = !isPremium
      ? "See which team has more room to move if they hit."
      : ready
      ? avgCeilingLeaderName && avgCeilingGap !== null
        ? `${avgCeilingLeaderName} has more scoring upside.`
        : "Ceiling is basically even."
      : "Select both teams to compare.";

    const consistencyEdge = !isPremium
      ? "Unlock"
      : hitRateGap !== null
      ? `${absGapLabel(hitRateGap, 1)}%`
      : "—";

    const consistencyDetail = !isPremium
      ? "Unlock hit zero rate to see who has the steadier path."
      : ready
      ? hitRateLeaderName && hitRateGap !== null
        ? `${hitRateLeaderName} has been cleaner across performances.`
        : "Consistency is very close."
      : "Select both teams to compare.";

    return [
      {
        title: "Average Score",
        icon: "🏆",
        leader: avgScoreLeaderName ?? "—",
        edge: avgEdge,
        detail: avgDetail,
        locked: false,
      },
      {
        title: "Winning Potential",
        icon: "🎯",
        leader: !isPremium
          ? "Premium"
          : ready
          ? avgCeilingLeaderName ?? "Even"
          : "—",
        edge: ceilingEdge,
        detail: ceilingDetail,
        locked: !isPremium,
      },
      {
        title: "Consistency",
        icon: "🔥",
        leader: !isPremium
          ? "Premium"
          : ready
          ? hitRateLeaderName ?? "Even"
          : "—",
        edge: consistencyEdge,
        detail: consistencyDetail,
        locked: !isPremium,
      },
    ];
  }, [
    avgScoreGap,
    avgScoreLeaderName,
    avgScoreTrailingName,
    isPremium,
    avgCeilingGap,
    avgCeilingLeaderName,
    hitRateGap,
    hitRateLeaderName,
    ready,
  ]);

  const hitZeroBarData = useMemo(
    () => [
      {
        name: teamAName,
        rate: Number(statsA.hitZeroRate.toFixed(1)),
        fill: RED,
      },
      {
        name: teamBName,
        rate: Number(statsB.hitZeroRate.toFixed(1)),
        fill: BLUE,
      },
    ],
    [statsA.hitZeroRate, statsB.hitZeroRate, teamAName, teamBName]
  );

  const verdictToneClasses =
    verdictBlock.tone === "clear"
      ? "border-teal-400/20 bg-teal-500/[0.06]"
      : verdictBlock.tone === "split"
      ? "border-amber-400/20 bg-amber-500/[0.06]"
      : verdictBlock.tone === "close"
      ? "border-white/10 bg-white/[0.03]"
      : "border-white/10 bg-white/[0.03]";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Elite Cheer Stats</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Team Comparison Tool
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
              Compare two teams side-by-side — who is ahead now, who has more upside, and who has
              been steadier.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {!premiumLoading && !isPremium ? (
              <Link
                href={lockedHref}
                className="inline-flex items-center rounded-xl bg-gradient-to-r from-teal-400 to-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(45,212,191,0.28)] transition hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(45,212,191,0.4)]"
              >
                {lockedCtaLabel}
              </Link>
            ) : null}

            <Link
              href="/"
              className="inline-flex items-center rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-700 hover:bg-slate-800"
            >
              Back to Home
            </Link>
          </div>
        </div>

        <div className={`rounded-2xl border px-5 py-5 ${verdictToneClasses}`}>
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Top Block</div>

          <div className="mt-3 text-2xl font-bold tracking-tight text-white md:text-3xl">
            {verdictBlock.headline}
          </div>

          <div className="mt-5 space-y-3">
            {verdictBlock.bullets.map((bullet, idx) => (
              <div key={`${bullet.icon}-${idx}`} className="flex items-start gap-3">
                <div className="pt-0.5 text-xl">{bullet.icon}</div>
                <div className="text-base text-slate-200 md:text-lg">{bullet.text}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-xl font-extrabold text-white md:text-2xl">
            {verdictBlock.verdict}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
          Compare any two teams to see who’s ahead now, who has more upside, and who has been more reliable.
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SearchPanel
            side="A"
            color="red"
            value={searchA}
            onChange={setSearchA}
            searching={searchingA}
            options={optionsA}
            selected={teamA}
            onSelect={(opt) => {
              setTeamA(opt);
              setSearchA(buildTeamName(opt));
              setOptionsA([]);
            }}
          />

          <SearchPanel
            side="B"
            color="blue"
            value={searchB}
            onChange={setSearchB}
            searching={searchingB}
            options={optionsB}
            selected={teamB}
            onSelect={(opt) => {
              setTeamB(opt);
              setSearchB(buildTeamName(opt));
              setOptionsB([]);
            }}
          />
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {insightCards.map((card) => (
            <InsightSummaryCard
              key={card.title}
              title={card.title}
              icon={card.icon}
              leader={card.leader}
              edge={card.edge}
              detail={card.detail}
              locked={card.locked}
              href={lockedHref}
              ctaLabel={lockedCtaLabel}
            />
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <StatCard
            title="Average Score"
            leftColor={RED}
            rightColor={BLUE}
            leftLabel={teamAName}
            rightLabel={teamBName}
            leftValue={loadingA ? "—" : fmt3(statsA.avgScore)}
            rightValue={loadingB ? "—" : fmt3(statsB.avgScore)}
          />

          {isPremium ? (
            <StatCard
              title="Average Ceiling"
              leftColor={RED}
              rightColor={BLUE}
              leftLabel={teamAName}
              rightLabel={teamBName}
              leftValue={loadingA ? "—" : fmt3(statsA.avgCeiling)}
              rightValue={loadingB ? "—" : fmt3(statsB.avgCeiling)}
            />
          ) : (
            <LockedStatCard
              title="Average Ceiling"
              leftColor={RED}
              rightColor={BLUE}
              leftLabel={teamAName}
              rightLabel={teamBName}
              teaser="See which team has more room to move if they hit."
              href={lockedHref}
              ctaLabel={lockedCtaLabel}
            />
          )}

          <StatCard
            title="Events Tracked"
            leftColor={RED}
            rightColor={BLUE}
            leftLabel={teamAName}
            rightLabel={teamBName}
            leftValue={loadingA ? "—" : String(statsA.eventCount)}
            rightValue={loadingB ? "—" : String(statsB.eventCount)}
          />
        </div>

        {!premiumLoading && !isPremium && ready && (
          <div className="mt-6 rounded-2xl border border-teal-400/15 bg-[#131f3a]/95 p-5 text-center">
            <div className="text-lg font-bold text-white">Score is only the surface.</div>
            <div className="mt-2 text-sm text-white/75">
              Unlock ceiling, hit zero rate, and the full side-by-side edge to see what really
              separates these teams.
            </div>

            <div className="mt-4 flex justify-center">
              <Link
                href={lockedHref}
                className="rounded-xl bg-gradient-to-r from-teal-400 to-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(45,212,191,0.28)] transition hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(45,212,191,0.4)]"
              >
                {lockedCtaLabel}
              </Link>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Season Trend</h2>
                <div className="mt-1 text-sm font-medium text-slate-300">{seasonLabel}</div>
                <p className="mt-1 text-sm text-slate-400">
                  Score trend by weekend, with optional ceiling overlay for deeper context.
                </p>
              </div>

              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <label className="inline-flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={showScore}
                    onChange={(e) => setShowScore(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-teal-400 focus:ring-teal-500"
                  />
                  Show Score
                </label>

                <label
                  className={`inline-flex items-center gap-3 rounded-xl border px-4 py-2 text-sm ${
                    !premiumLoading && isPremium
                      ? "border-teal-400/30 bg-teal-500/10 text-teal-200"
                      : "cursor-not-allowed border-teal-400/15 bg-teal-500/[0.06] text-white/60"
                  }`}
                  title={!premiumLoading && isPremium ? "Show ceiling overlay" : "Premium required"}
                >
                  <input
                    type="checkbox"
                    checked={!premiumLoading && isPremium ? showCeiling : false}
                    onChange={(e) => {
                      if (!isPremium) return;
                      setShowCeiling(e.target.checked);
                    }}
                    disabled={premiumLoading || !isPremium}
                    className="h-4 w-4 opacity-70"
                  />
                  <span className="font-semibold">Show Ceiling</span>
                  {!premiumLoading && !isPremium && (
                    <span className="ml-1 rounded-full border border-teal-400/20 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300">
                      Premium
                    </span>
                  )}
                </label>
              </div>
            </div>

            <div className="h-[420px]">
              {ready ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date_label"
                      tickFormatter={(value: string) => {
                        if (!chartData?.length) return "";
                        if (value === chartData[0].date_label) return value;
                        if (value === chartData[chartData.length - 1].date_label) return value;
                        return "";
                      }}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[85, 100]}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={{ stroke: "#334155" }}
                    />
                    <Tooltip
                      content={<ComparisonTooltip teamAName={teamAName} teamBName={teamBName} />}
                    />
                    <Legend />

                    {showScore ? (
                      <Line
                        type="monotone"
                        dataKey="teamA_score"
                        name={`${teamAName} Score`}
                        stroke={RED}
                        strokeWidth={4}
                        dot={{ r: 4 }}
                        connectNulls={true}
                      />
                    ) : null}

                    {!premiumLoading && isPremium && showCeiling ? (
                      <Line
                        type="monotone"
                        dataKey="teamA_ceiling"
                        name={`${teamAName} Ceiling`}
                        stroke={CEILING_A}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                        connectNulls={true}
                      />
                    ) : null}

                    {showScore ? (
                      <Line
                        type="monotone"
                        dataKey="teamB_score"
                        name={`${teamBName} Score`}
                        stroke={BLUE}
                        strokeWidth={4}
                        dot={{ r: 4 }}
                        connectNulls={true}
                      />
                    ) : null}

                    {!premiumLoading && isPremium && showCeiling ? (
                      <Line
                        type="monotone"
                        dataKey="teamB_ceiling"
                        name={`${teamBName} Ceiling`}
                        stroke={CEILING_B}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                        connectNulls={true}
                      />
                    ) : null}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-800 text-sm text-slate-500">
                  Search and select both teams to render the comparison.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white">Hit Zero Rate</h2>
              <p className="mt-1 text-sm text-slate-400">
                Performance-level zero-deduction rate, side-by-side.
              </p>
            </div>

            {isPremium ? (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-red-300">{teamAName}</div>
                    <div className="mt-2 text-3xl font-extrabold text-red-200">
                      {loadingA ? "—" : fmtPct(statsA.hitZeroRate)}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {loadingA ? "—" : `${statsA.hitZeroHits}/${statsA.hitZeroTotal} performances`}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-blue-300">{teamBName}</div>
                    <div className="mt-2 text-3xl font-extrabold text-blue-200">
                      {loadingB ? "—" : fmtPct(statsB.hitZeroRate)}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {loadingB ? "—" : `${statsB.hitZeroHits}/${statsB.hitZeroTotal} performances`}
                    </div>
                  </div>
                </div>

                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={hitZeroBarData}
                      layout="vertical"
                      margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
                    >
                      <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: "#cbd5e1", fontSize: 12 }}
                        width={130}
                      />
                      <Tooltip formatter={(value: any) => `${value}%`} />
                      <Bar dataKey="rate" radius={[0, 8, 8, 0]}>
                        {hitZeroBarData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#131f3a]/40 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-red-300">{teamAName}</div>
                    <div className="mt-2 text-3xl font-extrabold text-red-200">•••</div>
                    <div className="mt-2 text-center text-xs italic text-slate-300">
                      Cleaner teams often hold the edge when score is close.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-blue-300">{teamBName}</div>
                    <div className="mt-2 text-3xl font-extrabold text-blue-200">•••</div>
                    <div className="mt-2 text-center text-xs italic text-slate-300">
                      Score alone won’t tell you who has the steadier path.
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0b1220]/80 px-3 py-3">
                  <div className="text-xs font-medium text-white/80">Unlock full team comparison</div>

                  <Link
                    href={lockedHref}
                    className="rounded-xl bg-gradient-to-r from-teal-400 to-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 shadow-[0_0_16px_rgba(45,212,191,0.24)] transition hover:scale-[1.02]"
                  >
                    {lockedCtaLabel}
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>

        {!premiumLoading && !isPremium && ready && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
            <div className="text-base font-semibold text-white">
              There’s more separating these teams than average score.
            </div>
            <div className="mt-2 text-sm text-slate-400">
              Unlock ceiling, consistency, and the deeper edge to see what it really takes to close
              the gap.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function SearchPanel({
  side,
  color,
  value,
  onChange,
  searching,
  options,
  selected,
  onSelect,
}: {
  side: "A" | "B";
  color: "red" | "blue";
  value: string;
  onChange: (value: string) => void;
  searching: boolean;
  options: TeamOption[];
  selected: TeamOption | null;
  onSelect: (opt: TeamOption) => void;
}) {
  const isRed = color === "red";

  return (
    <div
      className={`rounded-2xl border p-4 shadow-lg shadow-black/20 ${
        isRed
          ? "border-red-900/40 bg-slate-900/70"
          : "border-blue-900/40 bg-slate-900/70"
      }`}
    >
      <div
        className={`mb-2 text-sm font-semibold uppercase tracking-wide ${
          isRed ? "text-red-300" : "text-blue-300"
        }`}
      >
        Team {side}
      </div>

      <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
        Search program or team
      </div>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={searchPlaceholder(side)}
        className={`w-full rounded-xl border bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500 ${
          isRed
            ? "border-red-500/30 focus:border-red-500 focus:shadow-[0_0_0_1px_rgba(239,68,68,0.15)]"
            : "border-blue-500/30 focus:border-blue-500 focus:shadow-[0_0_0_1px_rgba(59,130,246,0.15)]"
        }`}
      />

      <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60">
        {searching ? (
          <div className="px-4 py-3 text-sm text-slate-400">Searching…</div>
        ) : options.length ? (
          options.map((opt) => (
            <button
              key={opt.team_id}
              onClick={() => onSelect(opt)}
              className="block w-full border-b border-slate-800 px-4 py-3 text-left text-sm transition hover:bg-slate-800/70 last:border-b-0"
            >
              <div className="font-semibold text-white">
                {[opt.program, opt.team].filter(Boolean).join(" • ")}
              </div>
              <div className="mt-1 text-xs text-slate-400">{opt.division ?? "—"}</div>
            </button>
          ))
        ) : (
          <div className="px-4 py-3 text-sm text-slate-500">Type at least 2 characters to search.</div>
        )}
      </div>

      <div
        className={`mt-3 rounded-xl px-4 py-3 text-sm ${
          isRed ? "bg-red-950/20 text-red-100" : "bg-blue-950/20 text-blue-100"
        }`}
      >
        {buildFullTeamLabel(selected)}
      </div>
    </div>
  );
}

function InsightSummaryCard({
  title,
  icon,
  leader,
  edge,
  detail,
  locked,
  href,
  ctaLabel,
}: {
  title: string;
  icon: string;
  leader: string;
  edge: string;
  detail: string;
  locked: boolean;
  href: string;
  ctaLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
        <span className="mr-2">{icon}</span>
        {title} {locked ? <span className="text-teal-300">🔒</span> : null}
      </div>

      <div className="mt-4 text-sm text-slate-400">Current Edge</div>
      <div className="mt-1 text-lg font-bold text-white">{leader}</div>
      <div className="mt-2 text-3xl font-extrabold text-teal-300">{edge}</div>
      <div className="mt-3 text-sm text-slate-300">{detail}</div>

      {locked ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0b1220]/80 px-3 py-3">
          <div className="text-xs font-medium text-white/80">Unlock full team insights</div>

          <Link
            href={href}
            className="rounded-xl bg-gradient-to-r from-teal-400 to-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 shadow-[0_0_16px_rgba(45,212,191,0.24)] transition hover:scale-[1.02]"
          >
            {ctaLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  title,
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  leftColor,
  rightColor,
}: {
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftValue: string;
  rightValue: string;
  leftColor: string;
  rightColor: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{title}</div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div
          className="flex h-[96px] flex-col justify-between rounded-xl p-3"
          style={{ backgroundColor: "rgba(15,23,42,0.7)", border: `1px solid ${leftColor}33` }}
        >
          <div className="text-xs text-slate-400">{leftLabel}</div>
          <div className="text-2xl font-extrabold" style={{ color: leftColor }}>
            {leftValue}
          </div>
        </div>

        <div
          className="flex h-[96px] flex-col justify-between rounded-xl p-3"
          style={{ backgroundColor: "rgba(15,23,42,0.7)", border: `1px solid ${rightColor}33` }}
        >
          <div className="text-xs text-slate-400">{rightLabel}</div>
          <div className="text-2xl font-extrabold" style={{ color: rightColor }}>
            {rightValue}
          </div>
        </div>
      </div>
    </div>
  );
}

function LockedStatCard({
  title,
  leftLabel,
  rightLabel,
  leftColor,
  rightColor,
  teaser,
  href,
  ctaLabel,
}: {
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftColor: string;
  rightColor: string;
  teaser: string;
  href: string;
  ctaLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
        {title} <span className="text-teal-300">🔒</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div
          className="flex h-[96px] flex-col justify-between rounded-xl p-3"
          style={{ backgroundColor: "rgba(15,23,42,0.7)", border: `1px solid ${leftColor}33` }}
        >
          <div className="text-xs text-slate-400">{leftLabel}</div>
          <div className="text-2xl font-extrabold" style={{ color: leftColor }}>
            •••
          </div>
        </div>

        <div
          className="flex h-[96px] flex-col justify-between rounded-xl p-3"
          style={{ backgroundColor: "rgba(15,23,42,0.7)", border: `1px solid ${rightColor}33` }}
        >
          <div className="text-xs text-slate-400">{rightLabel}</div>
          <div className="text-2xl font-extrabold" style={{ color: rightColor }}>
            •••
          </div>
        </div>
      </div>

      <div className="mt-3 text-center text-xs italic text-slate-300">{teaser}</div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0b1220]/80 px-3 py-3">
        <div className="text-xs font-medium text-white/80">Unlock full team insights</div>

        <Link
          href={href}
          className="rounded-xl bg-gradient-to-r from-teal-400 to-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 shadow-[0_0_16px_rgba(45,212,191,0.24)] transition hover:scale-[1.02]"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}

function ComparisonTooltip({ active, payload, teamAName, teamBName }: any) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload ?? {};

  const byKey: Record<string, any> = {};
  payload.forEach((p: any) => {
    byKey[p.dataKey] = p;
  });

  const renderItem = (item: any) => {
    if (!item) return null;

    return (
      <div className="mb-1 flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span className="text-slate-300">{item.name}:</span>
        <span className="font-semibold text-white">{fmt3(Number(item.value))}</span>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-2xl">
      {row.teamA_event_name && (
        <div className="mb-1 font-semibold text-red-300">
          {teamAName} Event: {row.teamA_event_name}
        </div>
      )}

      {row.teamB_event_name && (
        <div className="mb-2 font-semibold text-blue-300">
          {teamBName} Event: {row.teamB_event_name}
        </div>
      )}

      <div className="mb-3 text-[11px] text-slate-400">{row.date_label}</div>

      {renderItem(byKey["teamA_score"])}
      {renderItem(byKey["teamA_ceiling"])}

      <div className="h-2" />

      {renderItem(byKey["teamB_score"])}
      {renderItem(byKey["teamB_ceiling"])}
    </div>
  );
}