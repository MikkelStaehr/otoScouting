"use client";

import { useMemo, useState } from "react";
import { PLAYER_AXES, TEAM_AXES, DIAGONAL_PAIRS } from "@/lib/scatter-axes";
import { openPlayer } from "./player-modal";

export interface PlayerPoint {
  n: string;
  t: string;
  lg: string;
  age: number | null;
  min: number;
  out: number | null;
  v: Record<string, number | null>;
}
export interface TeamPoint {
  n: string;
  lg: string;
  v: Record<string, number | null>;
}

const LEAGUE_ABBR = (lg: string) => lg.slice(0, 3);

// ── plot geometry (viewBox units; the svg scales to its container) ──
const W = 1200;
const H = 600;
const M = { top: 18, right: 24, bottom: 52, left: 64 };

function niceTicks(min: number, max: number, count = 6): number[] {
  if (min === max) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let t = start; t <= max + step * 1e-6; t += step) out.push(Number(t.toFixed(6)));
  return out;
}

export function ScatterDashboard({
  players,
  teams,
}: {
  players: PlayerPoint[];
  teams: TeamPoint[];
}) {
  const [mode, setMode] = useState<"players" | "teams">("players");
  const [xKey, setXKey] = useState("goals");
  const [yKey, setYKey] = useState("xg");
  const [league, setLeague] = useState("ALL");
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<number | null>(null);

  const axes = mode === "players" ? PLAYER_AXES : TEAM_AXES;
  const xAxis = axes.find((a) => a.key === xKey) ?? axes[0]!;
  const yAxis = axes.find((a) => a.key === yKey) ?? axes[1]!;

  function switchMode(m: "players" | "teams") {
    setMode(m);
    const a = m === "players" ? PLAYER_AXES : TEAM_AXES;
    if (!a.some((x) => x.key === xKey)) setXKey(a[0]!.key);
    if (!a.some((x) => x.key === yKey)) setYKey(a[1]!.key);
    setHover(null);
  }

  const leagues = useMemo(() => {
    const src = mode === "players" ? players : teams;
    return [...new Set(src.map((p) => p.lg))].sort();
  }, [mode, players, teams]);

  // Build the filtered, plottable point set for the active mode.
  const points = useMemo(() => {
    const src = mode === "players" ? players : teams;
    const q = query.trim().toLowerCase();
    const out: {
      name: string;
      sub: string;
      lg: string;
      x: number;
      y: number;
      hit: boolean;
      key: string | null;
    }[] = [];
    for (const p of src) {
      if (league !== "ALL" && p.lg !== league) continue;
      const x = p.v[xAxis.key];
      const y = p.v[yAxis.key];
      if (x == null || y == null) continue;
      const isP = "t" in p;
      const name = p.n;
      const sub = isP ? `${(p as PlayerPoint).t} · ${LEAGUE_ABBR(p.lg)}` : LEAGUE_ABBR(p.lg);
      const hit = q.length > 0 && (name.toLowerCase().includes(q) || (isP && (p as PlayerPoint).t.toLowerCase().includes(q)));
      const key = isP ? `${(p as PlayerPoint).t}::${name}` : null;
      out.push({ name, sub, lg: p.lg, x, y, hit, key });
    }
    return out;
  }, [mode, players, teams, league, xAxis.key, yAxis.key, query]);

  const scale = useMemo(() => {
    if (points.length === 0) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    let x0 = Math.min(...xs), x1 = Math.max(...xs);
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    const px = (x1 - x0 || 1) * 0.06;
    const py = (y1 - y0 || 1) * 0.06;
    x0 -= px; x1 += px; y0 -= py; y1 += py;
    const sx = (v: number) => M.left + ((v - x0) / (x1 - x0)) * (W - M.left - M.right);
    const sy = (v: number) => H - M.bottom - ((v - y0) / (y1 - y0)) * (H - M.top - M.bottom);
    return { x0, x1, y0, y1, sx, sy };
  }, [points]);

  // Auto-label the standouts (furthest toward the top-right) + any search hits.
  const labeled = useMemo(() => {
    if (!scale) return new Set<number>();
    const rx = scale.x1 - scale.x0 || 1;
    const ry = scale.y1 - scale.y0 || 1;
    const ranked = points
      .map((p, i) => ({ i, s: (p.x - scale.x0) / rx + (p.y - scale.y0) / ry }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 7)
      .map((r) => r.i);
    const set = new Set(ranked);
    points.forEach((p, i) => p.hit && set.add(i));
    return set;
  }, [points, scale]);

  const showDiagonal = DIAGONAL_PAIRS.has(`${xAxis.key}|${yAxis.key}`);

  return (
    <div className="rounded-2xl border border-line bg-panel/30 p-3 sm:p-5">
      {/* controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-line-2">
          {(["players", "teams"] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`px-4 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                mode === m ? "bg-volt text-ink" : "bg-transparent text-muted hover:text-fg"
              }`}
            >
              {m === "players" ? "Spillere" : "Hold"}
            </button>
          ))}
        </div>

        <AxisSelect label="X" value={xKey} onChange={setXKey} axes={axes} />
        <AxisSelect label="Y" value={yKey} onChange={setYKey} axes={axes} />

        <select
          value={league}
          onChange={(e) => setLeague(e.target.value)}
          className="rounded-lg border border-line-2 bg-ink px-3 py-1.5 font-mono text-xs text-fg outline-none focus:border-volt/50"
        >
          <option value="ALL">Alle ligaer</option>
          {leagues.map((lg) => (
            <option key={lg} value={lg}>{lg}</option>
          ))}
        </select>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === "players" ? "Søg spiller/hold…" : "Søg hold…"}
          className="w-48 rounded-lg border border-line-2 bg-ink px-3 py-1.5 text-sm text-fg outline-none placeholder:text-faint focus:border-volt/50"
        />

        <span className="ml-auto font-mono text-xs text-faint">
          {points.length} {mode === "players" ? "spillere" : "hold"}
          {mode === "players" && <span className="ml-1">· min. 450 min.</span>}
        </span>
      </div>

      {/* plot — height-bounded so it never sprawls on wide screens */}
      <div className="w-full" style={{ height: "min(64vh, 600px)", minHeight: 360 }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        {scale && (
          <>
            {/* gridlines + ticks */}
            {niceTicks(scale.x0, scale.x1).map((t) => (
              <g key={`x${t}`}>
                <line x1={scale.sx(t)} y1={M.top} x2={scale.sx(t)} y2={H - M.bottom}
                  stroke="var(--color-line)" strokeWidth={1} />
                <text x={scale.sx(t)} y={H - M.bottom + 18} textAnchor="middle"
                  className="fill-faint" style={{ fontSize: 12, fontFamily: "monospace" }}>{t}</text>
              </g>
            ))}
            {niceTicks(scale.y0, scale.y1).map((t) => (
              <g key={`y${t}`}>
                <line x1={M.left} y1={scale.sy(t)} x2={W - M.right} y2={scale.sy(t)}
                  stroke="var(--color-line)" strokeWidth={1} />
                <text x={M.left - 10} y={scale.sy(t) + 4} textAnchor="end"
                  className="fill-faint" style={{ fontSize: 12, fontFamily: "monospace" }}>{t}</text>
              </g>
            ))}

            {/* y = x reference line (same-unit pairs only) */}
            {showDiagonal && (() => {
              const lo = Math.max(scale.x0, scale.y0);
              const hi = Math.min(scale.x1, scale.y1);
              return lo < hi ? (
                <line x1={scale.sx(lo)} y1={scale.sy(lo)} x2={scale.sx(hi)} y2={scale.sy(hi)}
                  stroke="rgba(77,124,90,0.9)" strokeWidth={1.5} strokeDasharray="5 5" />
              ) : null;
            })()}

            {/* axis titles */}
            <text x={(M.left + W - M.right) / 2} y={H - 6} textAnchor="middle"
              className="fill-muted" style={{ fontSize: 13 }}>{xAxis.label}</text>
            <text x={-(M.top + H - M.bottom) / 2} y={16} transform="rotate(-90)" textAnchor="middle"
              className="fill-muted" style={{ fontSize: 13 }}>{yAxis.label}</text>

            {/* dots */}
            {points.map((p, i) => {
              const on = hover === i;
              const hit = p.hit;
              return (
                <circle
                  key={i}
                  cx={scale.sx(p.x)}
                  cy={scale.sy(p.y)}
                  r={hit || on ? 6 : 4.5}
                  fill={hit ? "rgba(180,105,74,0.95)" : "rgba(90,124,168,0.5)"}
                  stroke={on ? "var(--color-fg)" : "none"}
                  strokeWidth={on ? 1.5 : 0}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                  onClick={() => p.key && openPlayer(p.key)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}

            {/* standout + search labels */}
            {[...labeled].map((i) => {
              const p = points[i];
              if (!p) return null;
              const x = scale.sx(p.x);
              const y = scale.sy(p.y);
              const right = x < W - 140;
              return (
                <text key={`l${i}`} x={right ? x + 8 : x - 8} y={y - 6}
                  textAnchor={right ? "start" : "end"}
                  className={p.hit ? "fill-fg" : "fill-muted"}
                  style={{ fontSize: 11, fontWeight: p.hit ? 600 : 400 }}>{p.name}</text>
              );
            })}

            {/* hover tooltip — each field on its own line so nothing collides */}
            {hover != null && points[hover] && (() => {
              const p = points[hover]!;
              const x = scale.sx(p.x);
              const y = scale.sy(p.y);
              const w = 210;
              const h = 74;
              const left = x > W - w - 20 ? x - w - 10 : x + 10;
              const top = Math.min(Math.max(y - 30, M.top), H - M.bottom - h);
              const row = (label: string, val: number, dy: number) => (
                <g>
                  <text x={left + 10} y={top + dy} className="fill-muted" style={{ fontSize: 10 }}>
                    {label}
                  </text>
                  <text x={left + w - 10} y={top + dy} textAnchor="end" className="fill-volt"
                    style={{ fontSize: 11, fontFamily: "monospace" }}>
                    {val.toFixed(2)}
                  </text>
                </g>
              );
              return (
                <g pointerEvents="none">
                  <rect x={left} y={top} width={w} height={h} rx={6}
                    fill="var(--color-ink-2)" stroke="var(--color-line-2)" />
                  <text x={left + 10} y={top + 18} className="fill-fg" style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</text>
                  <text x={left + 10} y={top + 33} className="fill-muted" style={{ fontSize: 11 }}>{p.sub}</text>
                  {row(xAxis.label, p.x, 52)}
                  {row(yAxis.label, p.y, 67)}
                </g>
              );
            })()}
          </>
        )}
        {!scale && (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-muted" style={{ fontSize: 14 }}>
            Ingen data for disse akser endnu.
          </text>
        )}
      </svg>
      </div>
    </div>
  );
}

function AxisSelect({
  label,
  value,
  onChange,
  axes,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  axes: { key: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-ink px-2 py-1">
      <span className="font-mono text-[10px] uppercase text-faint">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent py-0.5 pr-1 text-xs text-fg outline-none"
      >
        {axes.map((a) => (
          <option key={a.key} value={a.key}>{a.label}</option>
        ))}
      </select>
    </label>
  );
}
