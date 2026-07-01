"use client";

// Shared pitch heatmap — a binned intensity grid rendered as smooth blobs on a
// pitch. Used for a player's season heatmap and a team's minute-weighted
// composite. Grid is row-major, 0-1 intensity (x = length, attacking →).

export interface PitchGrid {
  w: number;
  h: number;
  grid: number[];
}

// Warm heat ramp (pale → amber → clay → deep red) — reads clearly on the light
// panel and stays on-brand instead of a single flat orange.
const HEAT_STOPS: [number, [number, number, number, number]][] = [
  [0.0, [236, 206, 132, 0.0]],
  [0.14, [236, 206, 132, 0.55]],
  [0.4, [224, 150, 72, 0.74]],
  [0.7, [198, 92, 50, 0.88]],
  [1.0, [165, 45, 40, 0.97]],
];
function heatColor(v: number): string {
  const t = Math.max(0, Math.min(1, Math.pow(v, 0.7)));
  let a = HEAT_STOPS[0]!;
  let b = HEAT_STOPS[HEAT_STOPS.length - 1]!;
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    if (t >= HEAT_STOPS[i]![0] && t <= HEAT_STOPS[i + 1]![0]) {
      a = HEAT_STOPS[i]!;
      b = HEAT_STOPS[i + 1]!;
      break;
    }
  }
  const f = (t - a[0]) / ((b[0] - a[0]) || 1);
  const c = a[1].map((av, i) => av + (b[1][i]! - av) * f);
  return `rgba(${Math.round(c[0]!)},${Math.round(c[1]!)},${Math.round(c[2]!)},${c[3]!.toFixed(3)})`;
}

export function PitchHeatmap({ hm, id = "hm" }: { hm: PitchGrid; id?: string }) {
  const W = 320;
  const H = 208; // ~1.54 pitch aspect
  const cw = W / hm.w;
  const ch = H / hm.h;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-xl"
      style={{ aspectRatio: `${W}/${H}`, background: "var(--color-ink-2)" }}
    >
      <defs>
        {/* soften the coarse grid into smooth blobs */}
        <filter id={`${id}-blur`} x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur stdDeviation="6.5" />
        </filter>
        <clipPath id={`${id}-clip`}>
          <rect x={0} y={0} width={W} height={H} rx={11} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id}-clip)`}>
        <g filter={`url(#${id}-blur)`}>
          {hm.grid.map((v, i) => {
            if (v <= 0.012) return null;
            const col = i % hm.w;
            const row = Math.floor(i / hm.w);
            return (
              <rect
                key={i}
                x={col * cw - 1}
                y={row * ch - 1}
                width={cw + 2}
                height={ch + 2}
                fill={heatColor(v)}
              />
            );
          })}
        </g>
      </g>

      {/* pitch markings — thin + subtle, drawn over the heat */}
      <g stroke="var(--color-line-2)" strokeWidth={0.8} fill="none" opacity={0.5}>
        <rect x={1} y={1} width={W - 2} height={H - 2} rx={11} />
        <line x1={W / 2} y1={2} x2={W / 2} y2={H - 2} />
        <circle cx={W / 2} cy={H / 2} r={26} />
        <circle cx={W / 2} cy={H / 2} r={1.6} fill="var(--color-line-2)" stroke="none" />
        <rect x={1} y={H / 2 - 38} width={44} height={76} />
        <rect x={W - 45} y={H / 2 - 38} width={44} height={76} />
        <rect x={1} y={H / 2 - 18} width={16} height={36} />
        <rect x={W - 17} y={H / 2 - 18} width={16} height={36} />
      </g>
      <text x={W - 7} y={14} textAnchor="end" className="fill-faint" style={{ fontSize: 9, fontFamily: "monospace" }}>
        angreb →
      </text>
    </svg>
  );
}
