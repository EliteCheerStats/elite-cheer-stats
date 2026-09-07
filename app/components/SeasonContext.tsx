"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabaseClient";

type Season = {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
};

type SeasonContextValue = {
  seasons: Season[];
  selectedSeason: Season | null;
  setSelectedSeasonId: (seasonId: string) => void;
  loading: boolean;
};

const SeasonContext = createContext<SeasonContextValue | undefined>(undefined);

export function SeasonProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonIdState] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSeasons() {
      setLoading(true);

      const { data, error } = await supabase
        .from("seasons")
        .select("id,label,starts_on,ends_on,is_active")
        .order("starts_on", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Failed to load seasons:", error);
        setLoading(false);
        return;
      }

      const loaded = (data ?? []) as Season[];

      setSeasons(loaded);

      // The season marked active in Supabase is the global default.
      const activeSeason = loaded.find((season) => season.is_active);

      if (activeSeason) {
        setSelectedSeasonIdState(activeSeason.id);
      } else if (loaded.length > 0) {
        // Fallback to newest season if none is marked active.
        setSelectedSeasonIdState(loaded[0].id);
      } else {
        setSelectedSeasonIdState(null);
      }

      setLoading(false);
    }

    loadSeasons();

    return () => {
      cancelled = true;
    };
  }, []);

  const setSelectedSeasonId = (seasonId: string) => {
    const seasonExists = seasons.some((season) => season.id === seasonId);

    if (!seasonExists) {
      console.warn(`Attempted to select unknown season: ${seasonId}`);
      return;
    }

    setSelectedSeasonIdState(seasonId);
  };

  const selectedSeason = useMemo(() => {
    if (!selectedSeasonId) return null;

    return (
      seasons.find((season) => season.id === selectedSeasonId) ?? null
    );
  }, [seasons, selectedSeasonId]);

  const value: SeasonContextValue = {
    seasons,
    selectedSeason,
    setSelectedSeasonId,
    loading,
  };

  return (
    <SeasonContext.Provider value={value}>
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeason() {
  const context = useContext(SeasonContext);

  if (!context) {
    throw new Error("useSeason must be used inside SeasonProvider");
  }

  return context;
}