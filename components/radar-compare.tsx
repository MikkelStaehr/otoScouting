"use client";

// Radar comparison for 2–3 players from the compact ShortlistPlayer payload
// (percentiles + per-90). Used from the watch-list view to answer "which of these
// do we sign". Outfield vs GK axis set chosen automatically.

import { useEffect, useState } from "react";
import { METRIC_LABEL } from "@/lib/metrics";
import { RATE_METRICS } from "@/lib/shortlist-metrics";
import type { MetricKey } from "@/lib/types";

export interface ComparePlayer {
  key: string;
  n: string;
  t: string;
  lg: string;
  pos: string | null;
  age: number | null;
  min: number;
  out: number | null;
  isGk: boolean;
  p: Record<string, number | null>;
  v: Record<string, number | null>;
}

// Distinguishable series colours on cream: ink, slate-blue, clay.
const COLORS = ["#26221b", "#5d6f86", "#b4694a"];
const AXES_OUT: MetricKey[] = [
  "npg", "xg", "xa", "key_passes", "dribbles", "pass_pct", "tackles", "interceptions", "aerial_won", "duels_won_pct",
];
const AXES_GK: MetricKey[] = ["gk_save_pct", "gk_saves", "gk_clean_sheets", "gk_goals_prevented"];

const fmt = (m: string, v: number | null) =>
  v == null ? "—" : RATE_METRICS.has(m) ? `${v.toFixed(0)}%` : v.toFixed(2);

export function RadarCompare({ players, onClose }: { players: ComparePlayer[]; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const axes = players.every((p) => p.isGk) ? AXES_GK : AXES_OUT;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8">
      <button aria-label="Luk" onClick={onClose} className={`absolute inset-0 cursor-default bg-black/35 backdrop-blur-lg transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`} />
      <div className={`relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line-2 bg-panel/95 shadow-2xl shadow-black/60 transition duration-200 ${visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0"}`}>
        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {players.map((p, i) => (
              <div key={p.key}>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-lg font-bold tracking-tight" style={{ color: COLORS[i] }}>{p.n}</span>
                  {p.out != null && <span className="tnum font-mono text-sm font-bold" style={{ color: COLORS[i] }}>{p.out}</span>}
                </div>
                <div className="ml-4.5 mt-0.5 font-mono text-[10px] text-muted">
                  {p.t} · {p.lg.slice(0, 3)}{p.pos ? ` · ${p.pos}` : ""}{p.age != null ? ` · ${p.age}å` : ""} · {p.min}′
                </div>
              </div>
            ))}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-md border border-line-2 px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:text-fg">esc</button>
        </div>

        {/* body */}
        <div className="grid gap-6 overflow-y-auto p-6 lg:grid-cols-[auto_1fr]">
          <div className="flex items-center justify-center">
            <Radar players={players} axes={axes} />
          </div>
          <div className="flex flex-col justify-center">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-faint">Nøgletal /90 · percentil</div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line/60">
                  <th className="py-1 text-left font-mono text-[10px] uppercase tracking-wider text-faint">Metric</th>
                  {players.map((p, i) => (
                    <th key={p.key} className="py-1 text-right font-mono text-[10px] uppercase tracking-wider" style={{ color: COLORS[i] }}>
                      {p.n.split(" ").slice(-1)[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {axes.map((m) => {
                  const best = Math.max(...players.map((p) => p.p[m] ?? -1));
                  return (
                    <tr key={m} className="border-t border-line/40">
                      <td className="py-1 text-left text-muted" title={String(m)}>{METRIC_LABEL[m]}</td>
                      {players.map((p) => {
                        const pct = p.p[m] ?? null;
                        const isBest = pct != null && pct === best && players.length > 1;
                        return (
                          <td key={p.key} className={`py-1 text-right tnum ${isBest ? "font-bold text-fg" : "text-muted"}`}>
                            {fmt(m, p.v[m] ?? null)}
                            <span className="ml-1 font-mono text-[9px] text-faint">{pct != null ? Math.round(pct) : "—"}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 font-mono text-[10px] text-faint">Radar + tal = percentil i puljen (fed = højest). Tal foran = per-90 / rate.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Radar({ players, axes }: { players: ComparePlayer[]; axes: MetricKey[] }) {
  const size = 340;
  const cx = size / 2;
  const cy = size / 2;
  const R = 122;
  const n = axes.length;
  const angle = (i: number) => (-90 + (i * 360) / n) * (Math.PI / 180);
  const point = (i: number, value: number) => {
    const r = (R * value) / 100;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;
  };
  const polygon = (vals: number[]) => vals.map((v, i) => point(i, v).join(",")).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {[25, 50, 75, 100].map((ring) => (
        <polygon key={ring} points={polygon(axes.map(() => ring))} fill="none" stroke="var(--color-line-2)" strokeWidth={1} opacity={ring === 100 ? 0.8 : 0.4} />
      ))}
      {axes.map((m, i) => {
        const [x, y] = point(i, 100);
        const [lx, ly] = point(i, 120);
        return (
          <g key={m}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-line-2)" strokeWidth={1} opacity={0.4} />
            <text x={lx} y={ly} textAnchor={Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end"} dominantBaseline="middle" className="fill-muted font-mono" fontSize={9}>
              {METRIC_LABEL[m]}
            </text>
          </g>
        );
      })}
      {/* draw in reverse so player 1 sits on top */}
      {[...players].reverse().map((p, ri) => {
        const i = players.length - 1 - ri;
        const vals = axes.map((m) => p.p[m] ?? 0);
        return <polygon key={p.key} points={polygon(vals)} fill={COLORS[i]} fillOpacity={0.15} stroke={COLORS[i]} strokeWidth={1.5} />;
      })}
    </svg>
  );
}
