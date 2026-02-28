"use client";

import React, { useMemo } from "react";

type Item = {
  key: string;
  label: string;     // shown left of bar
  legendLabel: string; // shown in legend
  value: number;     // avg event score
};

const COLORS = [
  "#22c55e", "#3b82f6", "#f97316", "#ef4444", "#a855f7",
  "#06b6d4", "#eab308", "#14b8a6", "#f43f5e", "#60a5fa",
];

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function BarRankingsChart({
  items,
  title = "Top 10 — Average Event Score",
  height = 360,
}: {
  items: Item[];
  title?: string;
  height?: number;
}) {
  const { minX, maxX, ticks } = useMemo(() => {
    if (!items.length) return { minX: 0, maxX: 1, ticks: [0, 1] };

    const vals = items.map((x) => x.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);

    // ✅ Zoomed axis like your screenshot (not 0–100)
    // Add small padding so bars don’t pin to edges
    const pad = Math.max(0.08, (max - min) * 0.15);
    const minX = min - pad;
    const maxX = max + pad;

    // 5 ticks
    const t0 = minX;
    const t4 = maxX;
    const step = (t4 - t0) / 4;
    const ticks = Array.from({ length: 5 }, (_, i) => t0 + step * i);

    return { minX, maxX, ticks };
  }, [items]);

  // Layout
  const W = 980; // virtual svg width
  const H = height;

  const leftLabelW = 320;
  const rightLegendW = 280;
  const chartLeft = leftLabelW + 12;
  const chartRight = W - rightLegendW - 18;
  const chartW = chartRight - chartLeft;

  const topPad = 42;
  const bottomPad = 34;

  const rowH = items.length ? (H - topPad - bottomPad) / items.length : 1;
  const barH = clamp(rowH * 0.55, 10, 18);

  const xFor = (v: number) => {
    const t = (v - minX) / (maxX - minX || 1);
    return chartLeft + clamp(t, 0, 1) * chartW;
  };

  if (!items.length) {
    return (
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 14,
          background: "rgba(255,255,255,0.04)",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>
        <div style={{ opacity: 0.7 }}>No data for current filters.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        background: "rgba(255,255,255,0.04)",
        padding: 12,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* vertical grid lines + x labels */}
        {ticks.map((t, i) => {
          const x = xFor(t);
          return (
            <g key={i}>
              <line
                x1={x}
                x2={x}
                y1={topPad - 6}
                y2={H - bottomPad}
                stroke="rgba(255,255,255,0.10)"
              />
              <text
                x={x}
                y={H - 10}
                textAnchor="middle"
                fontSize="12"
                fill="rgba(255,255,255,0.70)"
              >
                {t.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {items.map((it, idx) => {
          const yMid = topPad + idx * rowH + rowH / 2;
          const y = yMid - barH / 2;

          const x0 = chartLeft;
          const x1 = xFor(it.value);
          const w = Math.max(2, x1 - x0);

          const color = COLORS[idx % COLORS.length];

          return (
            <g key={it.key}>
              {/* left label */}
              <text
                x={leftLabelW}
                y={yMid + 4}
                textAnchor="end"
                fontSize="13"
                fill="rgba(255,255,255,0.88)"
              >
                {it.label}
              </text>

              {/* bar */}
              <rect
                x={x0}
                y={y}
                width={w}
                height={barH}
                rx={6}
                fill={color}
                opacity={0.95}
              />

              {/* value label */}
              <text
                x={x0 + w + 8}
                y={yMid + 4}
                textAnchor="start"
                fontSize="12"
                fill="rgba(255,255,255,0.80)"
              >
                {it.value.toFixed(3)}
              </text>
            </g>
          );
        })}

        {/* Legend */}
        <g>
          <text
            x={W - rightLegendW + 10}
            y={topPad - 14}
            fontSize="12"
            fill="rgba(255,255,255,0.75)"
            fontWeight={700}
          >
            Legend
          </text>

          {items.map((it, idx) => {
            const y = topPad + idx * 18;
            const color = COLORS[idx % COLORS.length];

            return (
              <g key={`leg-${it.key}`}>
                <rect
                  x={W - rightLegendW + 10}
                  y={y - 10}
                  width={10}
                  height={10}
                  fill={color}
                  rx={2}
                />
                <text
                  x={W - rightLegendW + 26}
                  y={y - 1}
                  fontSize="12"
                  fill="rgba(255,255,255,0.80)"
                >
                  {it.legendLabel}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}