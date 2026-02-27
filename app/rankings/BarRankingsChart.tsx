type RankingRow = {
  program: string;
  team_name: string;
  avg_score: number | string;
};

const COLORS = [
  "#22c55e", "#3b82f6", "#f97316", "#a855f7", "#06b6d4",
  "#ef4444", "#eab308", "#14b8a6", "#8b5cf6", "#f43f5e",
];

function toNum(v: any) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function BarRankingsChart({ rankings }: { rankings: RankingRow[] }) {
  if (!rankings?.length) return null;

  const data = rankings.slice(0, 10).map((r) => ({
    label: `${r.team_name}`,
    score: toNum(r.avg_score),
  }));

  // chart box
  const width = 1100;
  const height = 360;
  const pad = { top: 18, right: 300, bottom: 35, left: 320 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  

  const scores = data.map((d) => d.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = Math.max(0.001, max - min);

  const barH = innerH / data.length;
  const barInnerH = Math.max(10, barH * 0.62);

  // x scale: score -> pixels
  const x = (score: number) => ((score - min) / span) * innerW;

  // nice ticks
  const ticks = 5;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => min + (span * i) / ticks);

  return (
    <div className="w-full overflow-x-auto">
      <div className="w-full">
        <div className="mb-2 text-sm text-slate-200 font-semibold">
          Top 10 — Average Event Score
        </div>

        <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height="360"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "block" }}
        >
          {/* background */}
          <rect x={0} y={0} width={width} height={height} fill="rgba(2,6,23,0.35)" rx={12} />

          {/* plot area */}
          <g transform={`translate(${pad.left},${pad.top})`}>
            {/* x grid + ticks */}
            {tickVals.map((v, i) => {
              const px = x(v);
              return (
                <g key={i}>
                  <line x1={px} y1={0} x2={px} y2={innerH} stroke="rgba(255,255,255,0.10)" />
                  <text
                    x={px}
                    y={innerH + 22}
                    textAnchor="middle"
                    fontSize={12}
                    fill="rgba(226,232,240,0.7)"
                  >
                    {v.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* bars + y labels */}
            {data.map((d, i) => {
              const y = i * barH + (barH - barInnerH) / 2;
              const w = x(d.score);
              const color = COLORS[i % COLORS.length];

              return (
                <g key={d.label}>
                  {/* y label */}
                  <text
                    x={-12}
                    y={i * barH + barH / 2 + 4}
                    textAnchor="end"
                    fontSize={12}
                    fill="rgba(226,232,240,0.85)"
                  >
                    {d.label}
                  </text>

                  {/* bar */}
                  <rect x={0} y={y} width={w} height={barInnerH} fill={color} rx={6} />

                  {/* value at end */}
                  <text
                    x={Math.min(w + 8, innerW - 2)}
                    y={i * barH + barH / 2 + 4}
                    fontSize={12}
                    fill="rgba(226,232,240,0.85)"
                  >
                    {d.score.toFixed(3)}
                  </text>
                </g>
              );
            })}
          </g>

          {/* legend (right side) */}
          <g transform={`translate(${width - pad.right + 20},${pad.top})`}>
            <text fontSize={12} fill="rgba(226,232,240,0.85)" fontWeight={700}>
              Legend
            </text>

            {data.map((d, i) => {
              const y = 18 + i * 18;
              const color = COLORS[i % COLORS.length];
              return (
                <g key={d.label} transform={`translate(0,${y})`}>
                  <rect x={0} y={-10} width={10} height={10} rx={2} fill={color} />
                  <text x={16} y={0} fontSize={11} fill="rgba(226,232,240,0.75)">
                    {d.label.length > 28 ? d.label.slice(0, 28) + "…" : d.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}