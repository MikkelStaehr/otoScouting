"use client";

// Zone analysis — the season heatmap grid aggregated into coarse zones with the
// share of activity (touches) in each. Honest scope: this is touch distribution,
// not per-action-type (passes/tackles/shots per zone would need match-event data
// we don't ingest). Same grid drives player + team views.

import type { PitchGrid } from "./pitch-heatmap";

export function ZonePitch({ hm, cols = 3, rows = 3, id = "zp" }: { hm: PitchGrid; cols?: number; rows?: number; id?: string }) {
  const W = 320;
  const H = 208;
  const zones = new Array(cols * rows).fill(0);
  for (let r = 0; r < hm.h; r++) {
    for (let c = 0; c < hm.w; c++) {
      const v = hm.grid[r * hm.w + c] ?? 0;
      if (v <= 0) continue;
      const zc = Math.min(cols - 1, Math.floor((c / hm.w) * cols));
      const zr = Math.min(rows - 1, Math.floor((r / hm.h) * rows));
      zones[zr * cols + zc] += v;
    }
  }
  const total = zones.reduce((a, b) => a + b, 0) || 1;
  const shares = zones.map((z) => z / total);
  const maxShare = Math.max(...shares, 1e-9);

  const cw = W / cols;
  const ch = H / rows;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl" style={{ aspectRatio: `${W}/${H}`, background: "var(--color-ink-2)" }}>
      <clipPath id={`${id}-clip`}>
        <rect x={0} y={0} width={W} height={H} rx={11} />
      </clipPath>
      <g clipPath={`url(#${id}-clip)`}>
        {shares.map((s, i) => {
          const zc = i % cols;
          // Mirror rows so left flank is on top (Sofascore y runs opposite).
          const zr = rows - 1 - Math.floor(i / cols);
          const a = (s / maxShare) * 0.82;
          const pct = Math.round(s * 100);
          return (
            <g key={i}>
              <rect x={zc * cw} y={zr * ch} width={cw} height={ch} fill={`rgba(197,90,48,${a.toFixed(3)})`} />
              <rect x={zc * cw} y={zr * ch} width={cw} height={ch} fill="none" stroke="var(--color-line-2)" strokeWidth={0.6} opacity={0.5} />
              <text
                x={zc * cw + cw / 2}
                y={zr * ch + ch / 2}
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontSize: 13, fontFamily: "ui-monospace, monospace", fontWeight: 600 }}
                fill={a > 0.42 ? "var(--color-ink)" : "var(--color-muted)"}
              >
                {pct >= 1 ? `${pct}%` : ""}
              </text>
            </g>
          );
        })}
      </g>
      {/* halfway + boxes for orientation */}
      <g stroke="var(--color-line-2)" strokeWidth={0.8} fill="none" opacity={0.45}>
        <rect x={1} y={1} width={W - 2} height={H - 2} rx={11} />
        <rect x={1} y={H / 2 - 34} width={30} height={68} />
        <rect x={W - 31} y={H / 2 - 34} width={30} height={68} />
      </g>
      <text x={W - 7} y={14} textAnchor="end" className="fill-faint" style={{ fontSize: 9, fontFamily: "monospace" }}>
        angreb →
      </text>
    </svg>
  );
}
