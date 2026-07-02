"use client";

// Team shape: each regular's real average position (heatmap centroid) as a dot on
// the pitch, sized by minutes and coloured by OUT (green = played best, clay =
// worst). The season heatmap sits faintly behind, with the top formation labelled.
// Directly answers "lay the formation over the heatmap, put the players in".

import type { PitchGrid } from "./pitch-heatmap";

export interface Dot {
  key: string;
  player: string;
  pos: string | null;
  cx: number;
  cy: number;
  cxA: number; cyA: number;
  cxD: number; cyD: number;
  out: number | null;
  minutes: number;
  isGk: boolean;
  role: string | null;
}

export type Phase = "all" | "att" | "def";

// OUT → clay (low) · amber (mid) · green (high).
function outColor(o: number | null): string {
  if (o == null) return "rgba(120,120,120,0.7)";
  if (o >= 65) return "rgba(77,124,90,0.95)";
  if (o >= 48) return "rgba(176,150,70,0.95)";
  return "rgba(180,105,74,0.95)";
}
const surname = (n: string) => n.split(" ").slice(-1)[0] ?? n;

export function FormationPitch({
  hm,
  dots,
  formation,
  phase = "all",
  onPick,
}: {
  hm: PitchGrid | null;
  dots: Dot[];
  formation: string | null;
  phase?: Phase;
  onPick: (key: string) => void;
}) {
  const px = (d: Dot) => (phase === "att" ? d.cxA : phase === "def" ? d.cxD : d.cx);
  const py = (d: Dot) => (phase === "att" ? d.cyA : phase === "def" ? d.cyD : d.cy);
  const W = 320;
  const H = 208;
  // The typical XI — the 11 most-used players (dots are pre-sorted by minutes).
  const shown = dots.slice(0, 11);
  const maxMin = Math.max(...shown.map((d) => d.minutes), 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl" style={{ aspectRatio: `${W}/${H}`, background: "var(--color-ink-2)" }}>
      <defs>
        <clipPath id="fp-clip"><rect x={0} y={0} width={W} height={H} rx={11} /></clipPath>
      </defs>

      {/* faint season heatmap behind */}
      {hm && (
        <g clipPath="url(#fp-clip)">
          {hm.grid.map((v, i) => {
            if (v <= 0.04) return null;
            const col = i % hm.w;
            const row = Math.floor(i / hm.w);
            return (
              <rect key={i} x={(col / hm.w) * W} y={(row / hm.h) * H} width={W / hm.w + 1} height={H / hm.h + 1}
                fill={`rgba(197,90,48,${(v * 0.28).toFixed(3)})`} />
            );
          })}
        </g>
      )}

      {/* pitch markings */}
      <g stroke="var(--color-line-2)" strokeWidth={0.8} fill="none" opacity={0.5}>
        <rect x={1} y={1} width={W - 2} height={H - 2} rx={11} />
        <line x1={W / 2} y1={2} x2={W / 2} y2={H - 2} />
        <circle cx={W / 2} cy={H / 2} r={24} />
        <rect x={1} y={H / 2 - 34} width={30} height={68} />
        <rect x={W - 31} y={H / 2 - 34} width={30} height={68} />
      </g>

      {/* player dots */}
      {shown.map((d) => {
        const x = px(d) * W;
        // Mirror the width axis so left flank is on top (Sofascore y is inverted).
        const y = (1 - py(d)) * H;
        const r = 5.5 + (d.minutes / maxMin) * 4;
        return (
          <g key={d.key} onClick={() => onPick(d.key)} style={{ cursor: "pointer" }}>
            <title>{d.player}{d.role ? ` — ${d.role}` : ""}</title>
            <circle cx={x} cy={y} r={r} fill={outColor(d.out)} stroke="var(--color-ink)" strokeWidth={1} />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="var(--color-ink)" style={{ fontSize: 8, fontWeight: 700, fontFamily: "ui-monospace, monospace", pointerEvents: "none" }}>
              {d.out ?? ""}
            </text>
            <text x={x} y={y + r + 7} textAnchor="middle" fill="var(--color-fg)" style={{ fontSize: 8, fontFamily: "ui-monospace, monospace", pointerEvents: "none" }}>
              {surname(d.player)}
            </text>
          </g>
        );
      })}

      {formation && (
        <text x={8} y={15} className="fill-fg" style={{ fontSize: 12, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
          {formation}
        </text>
      )}
      <text x={W - 7} y={14} textAnchor="end" className="fill-faint" style={{ fontSize: 9, fontFamily: "monospace" }}>angreb →</text>
    </svg>
  );
}
