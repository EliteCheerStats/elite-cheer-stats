"use client";

import { useSeason } from "@/app/components/SeasonContext";

export default function SeasonSelector() {
  const {
    seasons,
    selectedSeason,
    setSelectedSeasonId,
    loading,
  } = useSeason();

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400">
        Season…
      </div>
    );
  }

  if (!selectedSeason || seasons.length === 0) {
    return null;
  }

  return (
    <label className="flex items-center gap-2">
      <span className="hidden text-xs text-slate-400 md:inline">
        Season
      </span>

      <select
        value={selectedSeason.id}
        onChange={(e) => setSelectedSeasonId(e.target.value)}
        className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 outline-none hover:border-white/20"
        aria-label="Select season"
      >
        {seasons.map((season) => (
          <option key={season.id} value={season.id}>
            {season.id}
          </option>
        ))}
      </select>
    </label>
  );
}