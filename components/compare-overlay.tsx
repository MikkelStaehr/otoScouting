"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EnrichedPlayer, MetricKey } from "@/lib/types";
import { METRIC_LABEL } from "@/lib/metrics";

// Two calm, distinguishable series colours on cream — charcoal ink (A) and a
// muted slate-blue (B). A head-to-head needs two tones.
const A_COLOR = "#26221b";
const B_COLOR = "#5d6f86";

export function CompareOverlay({
  a,
  b,
  metrics,
  rates,
  onClose,
}: {
  a: EnrichedPlayer;
  b: EnrichedPlayer;
  metrics: MetricKey[];
  rates: MetricKey[];
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setVisible(false);
    closeTimer.current = setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = requestAnimationFrame(() => panelRef.current?.focus());

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Tab") {
        e.preventDefault(); // trap focus inside the panel
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(t);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [close]);

  const rateSet = new Set(rates);
  const fmt = (m: MetricKey, v: number | null) =>
    v === null ? "—" : rateSet.has(m) ? v.toFixed(1) : v.toFixed(2);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Compare ${a.player} and ${b.player}`}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8"
    >
      <button
        aria-label="Close comparison"
        tabIndex={-1}
        onClick={close}
        className={`absolute inset-0 cursor-default bg-black/30 backdrop-blur-lg transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line-2 bg-panel/95 shadow-2xl shadow-black/70 outline-none transition duration-200 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-stretch border-b border-line">
          <PlayerHead player={a} color={A_COLOR} align="left" />
          <div className="flex items-center px-3 font-mono text-xs text-faint">vs</div>
          <PlayerHead player={b} color={B_COLOR} align="right" />
          <button
            onClick={close}
            className="absolute right-3 top-3 rounded-md border border-line-2 px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:border-volt/50 hover:text-fg"
          >
            esc
          </button>
        </div>

        {/* Body */}
        <div className="grid gap-8 overflow-y-auto p-6 lg:grid-cols-[auto_1fr]">
          <div className="flex items-center justify-center">
            <Radar a={a} b={b} metrics={metrics} />
          </div>

          <div className="flex flex-col justify-center gap-2.5">
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-faint">
              <span style={{ color: A_COLOR }}>{a.player}</span>
              <span>percentile · per 90</span>
              <span style={{ color: B_COLOR }}>{b.player}</span>
            </div>
            {metrics.map((m) => {
              const pa = a.percentile[m] ?? 0;
              const pb = b.percentile[m] ?? 0;
              return (
                <div key={m}>
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="tnum w-12 text-left text-fg">{fmt(m, a.per90[m])}</span>
                    <span className="text-muted" title={String(m)}>{METRIC_LABEL[m]}</span>
                    <span className="tnum w-12 text-right text-fg">{fmt(m, b.per90[m])}</span>
                  </div>
                  <div className="mt-1 flex h-1.5 gap-px">
                    <div className="flex flex-1 justify-end">
                      <div
                        style={{ width: `${pa}%`, backgroundColor: A_COLOR }}
                        className="rounded-l-sm opacity-80"
                      />
                    </div>
                    <div className="flex-1">
                      <div
                        style={{ width: `${pb}%`, backgroundColor: B_COLOR }}
                        className="rounded-r-sm opacity-80"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="mt-2 font-mono text-[10px] text-faint">
              Bars = percentile within the pool. Numbers = per-90 (or rate).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerHead({
  player,
  color,
  align,
}: {
  player: EnrichedPlayer;
  color: string;
  align: "left" | "right";
}) {
  return (
    <div className={`flex-1 p-5 ${align === "right" ? "text-right" : "text-left"}`}>
      <div className="truncate text-2xl font-bold tracking-tight" style={{ color }}>
        {player.player}
      </div>
      <div className="mt-1 font-mono text-xs text-muted">
        {player.team} · {player.pos ?? "—"}
        {player.age ? ` · ${player.age}y` : ""} · {player.minutes}′
      </div>
      <div className={`mt-3 flex items-baseline gap-2 ${align === "right" ? "justify-end" : ""}`}>
        <span className="tnum text-3xl font-bold" style={{ color }}>
          {Math.round(player.outputScore ?? 0)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-faint">OUT</span>
      </div>
    </div>
  );
}

function Radar({
  a,
  b,
  metrics,
}: {
  a: EnrichedPlayer;
  b: EnrichedPlayer;
  metrics: MetricKey[];
}) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const R = 118;
  const n = metrics.length;

  const angle = (i: number) => (-90 + (i * 360) / n) * (Math.PI / 180);
  const point = (i: number, value: number) => {
    const r = (R * value) / 100;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;
  };
  const polygon = (vals: number[]) =>
    vals.map((v, i) => point(i, v).join(",")).join(" ");

  const aVals = metrics.map((m) => a.percentile[m] ?? 0);
  const bVals = metrics.map((m) => b.percentile[m] ?? 0);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* rings */}
      {[25, 50, 75, 100].map((ring) => (
        <polygon
          key={ring}
          points={polygon(metrics.map(() => ring))}
          fill="none"
          stroke="var(--color-line-2)"
          strokeWidth={1}
          opacity={ring === 100 ? 0.8 : 0.4}
        />
      ))}
      {/* spokes + labels */}
      {metrics.map((m, i) => {
        const [x, y] = point(i, 100);
        const [lx, ly] = point(i, 122);
        return (
          <g key={m}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-line-2)" strokeWidth={1} opacity={0.4} />
            <text
              x={lx}
              y={ly}
              textAnchor={Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end"}
              dominantBaseline="middle"
              className="fill-muted font-mono"
              fontSize={10}
            >
              {METRIC_LABEL[m]}
            </text>
          </g>
        );
      })}
      {/* B first (under), then A */}
      <polygon points={polygon(bVals)} fill={B_COLOR} fillOpacity={0.16} stroke={B_COLOR} strokeWidth={1.5} />
      <polygon points={polygon(aVals)} fill={A_COLOR} fillOpacity={0.18} stroke={A_COLOR} strokeWidth={1.5} />
    </svg>
  );
}
