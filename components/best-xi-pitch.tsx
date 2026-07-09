"use client";

import { useState } from "react";
import { teamLogoUrl } from "@/lib/team-logos";
import { openPlayer } from "./player-modal";
import type { BestXI, XIPlayer } from "@/lib/best-xi";

function TeamLogo({ team }: { team: string }) {
  const [ok, setOk] = useState(true);
  const url = teamLogoUrl(team);
  if (!url || !ok) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" onError={() => setOk(false)} loading="lazy" className="h-3.5 w-3.5 object-contain" />;
}

function fmtVal(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e6) return `€${(v / 1e6).toFixed(1)}m`;
  if (v >= 1e3) return `€${Math.round(v / 1e3)}k`;
  return `€${v}`;
}

function Card({ p }: { p: XIPlayer }) {
  return (
    <button
      onClick={() => openPlayer(p.key)}
      className="group flex w-[128px] flex-col items-center gap-0.5 rounded-xl border border-line-2 bg-panel/95 px-2 py-2 text-center shadow-sm shadow-black/10 transition hover:border-volt/60 hover:shadow-md"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-volt font-mono text-sm font-bold text-ink">
        {p.out ?? "—"}
      </div>
      <div className="mt-0.5 max-w-full truncate text-[13px] font-semibold leading-tight text-fg">
        {p.player}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-muted">
        <TeamLogo team={p.team} />
        <span className="max-w-[92px] truncate">{p.team}</span>
      </div>
      <div className="font-mono text-[9px] text-faint">
        {p.role ?? p.bucket}
        {p.marketValue != null && <span className="text-volt"> · {fmtVal(p.marketValue)}</span>}
      </div>
    </button>
  );
}

export function BestXIPitch({ xi }: { xi: BestXI }) {
  const byB: Record<string, XIPlayer[]> = {};
  xi.lineup.forEach((l) => (byB[l.bucket] = l.players));
  // 4-3-3 laid out attack → defence (front three interleave WIDE-STRIKER-WIDE).
  const rows: XIPlayer[][] = [
    [byB.WIDE?.[0], byB.STRIKER?.[0], byB.WIDE?.[1]],
    [byB.MID?.[0], byB.MID?.[1], byB.MID?.[2]],
    [byB.BACK?.[0], byB.CB?.[0], byB.CB?.[1], byB.BACK?.[1]],
    [byB.GK?.[0]],
  ].map((r) => r.filter(Boolean) as XIPlayer[]);

  return (
    <div className="space-y-5">
      <div
        className="relative overflow-hidden rounded-3xl border border-line-2 px-3 py-8 sm:px-8"
        style={{
          background:
            "repeating-linear-gradient(180deg, rgba(120,150,90,0.10) 0 56px, rgba(120,150,90,0.06) 56px 112px)",
        }}
      >
        {/* pitch markings */}
        <div className="pointer-events-none absolute inset-4 rounded-2xl border border-volt/20" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-volt/20" />
        <div className="pointer-events-none absolute left-4 right-4 top-1/2 border-t border-volt/20" />

        <div className="relative flex flex-col gap-6">
          {rows.map((row, i) => (
            <div key={i} className="flex justify-center gap-4 sm:gap-10">
              {row.map((p) => (
                <Card key={p.key} p={p} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {xi.bench.length > 0 && (
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Bænk</div>
          <div className="flex flex-wrap gap-2">
            {xi.bench.map((p) => (
              <button
                key={p.key}
                onClick={() => openPlayer(p.key)}
                className="flex items-center gap-2 rounded-full border border-line-2 bg-panel/80 px-3 py-1.5 text-xs transition hover:border-volt/60"
              >
                <span className="font-mono text-[11px] font-bold text-volt">{p.out ?? "—"}</span>
                <span className="font-medium text-fg">{p.player}</span>
                <span className="text-faint">{p.bucket}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
