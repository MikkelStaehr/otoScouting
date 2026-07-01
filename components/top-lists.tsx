"use client";

import { useEffect, useMemo, useState } from "react";
import { teamLogoUrl } from "@/lib/team-logos";
import { openPlayer } from "./player-modal";

export interface DashPlayer {
  n: string;
  t: string;
  lg: string;
  age: number | null;
  min: number;
  mp: number;
  pos: string | null;
  out: number | null;
  xg: number | null;
  goals: number;
  gp: number | null;
  isGk: boolean;
  m: Record<string, number | null>;
}

const LEAGUE_ABBR = (lg: string) => lg.slice(0, 3);
const FULL_CAP = 250; // "hele listen" — plenty for scouting
const primaryPos = (pos: string | null) => pos?.split(",")[0]?.trim() ?? null;

interface Spec {
  key: string;
  title: string;
  sub: string;
  pick: (p: DashPlayer) => number | null;
  fmt: (v: number) => string;
  filter?: (p: DashPlayer) => boolean;
  hint?: (p: DashPlayer) => string;
}

const per = (k: string) => (p: DashPlayer) => p.m[k] ?? null;
const f2 = (v: number) => v.toFixed(2);
const pct = (v: number) => `${v.toFixed(0)}%`;

// One leaderboard per attacking / creative / defensive / build-up dimension.
const SPECS: Spec[] = [
  { key: "danger", title: "Mest målfarlige", sub: "mål u. straffe /90", pick: per("npg"), fmt: f2 },
  { key: "out", title: "Bedste output", sub: "OUT · ligastyrke-justeret", pick: (p) => p.out, fmt: (v) => String(Math.round(v)) },
  { key: "u21", title: "Ones to watch · U21", sub: "unge der leverer (OUT)", pick: (p) => p.out, fmt: (v) => String(Math.round(v)), filter: (p) => p.age != null && p.age <= 21, hint: (p) => `${p.age} år` },
  { key: "chances", title: "Chance-skaberne", sub: "chances created /90", pick: per("key_passes"), fmt: f2 },
  { key: "bigchances", title: "Store chancer skabt", sub: "big chances created /90", pick: per("big_chances_created"), fmt: f2 },
  { key: "dribbles", title: "Driblerne", sub: "vellykkede driblinger /90", pick: per("dribbles"), fmt: f2 },
  { key: "underperf", title: "Uforløst — mål venter", sub: "xG minus mål (bør score mere)", pick: (p) => (p.xg ?? 0) - p.goals, fmt: (v) => `+${v.toFixed(1)}`, filter: (p) => (p.xg ?? 0) >= 3 },
  { key: "recover", title: "Boldgenerobrere", sub: "ball recoveries /90", pick: per("ball_recovery"), fmt: f2 },
  { key: "tackles", title: "Tacklemaskiner", sub: "tacklinger /90", pick: per("tackles"), fmt: f2 },
  { key: "aerial", title: "Luftdominans", sub: "luftdueller vundet /90", pick: per("aerial_won"), fmt: f2 },
  { key: "passing", title: "Afleverings-mestre", sub: "afleveringspræcision %", pick: per("pass_pct"), fmt: (v) => `${v.toFixed(1)}%` },
  { key: "gk", title: "Målmænd", sub: "goals prevented", pick: (p) => p.gp, fmt: (v) => v.toFixed(1), filter: (p) => p.isGk },
];

export function TopLists({ players }: { players: DashPlayer[] }) {
  const [open, setOpen] = useState<string | null>(null);

  const ranked = useMemo(() => {
    const map: Record<string, { p: DashPlayer; v: number }[]> = {};
    for (const s of SPECS) {
      map[s.key] = players
        .filter((p) => !s.filter || s.filter(p))
        .map((p) => ({ p, v: s.pick(p) }))
        .filter((x): x is { p: DashPlayer; v: number } => x.v != null)
        .sort((a, b) => b.v - a.v);
    }
    return map;
  }, [players]);

  const openSpec = SPECS.find((s) => s.key === open) ?? null;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SPECS.map((s) => (
          <Card key={s.key} spec={s} rows={ranked[s.key]!} onOpen={() => setOpen(s.key)} />
        ))}
      </div>
      {openSpec && (
        <FullListModal spec={openSpec} rows={ranked[openSpec.key]!} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

function Card({
  spec,
  rows,
  onOpen,
}: {
  spec: Spec;
  rows: { p: DashPlayer; v: number }[];
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-line bg-panel/30 p-3.5">
      <div className="mb-2 flex items-start justify-between border-b border-line/60 pb-2">
        <div>
          <div className="font-display text-sm font-bold text-fg">{spec.title}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-faint">{spec.sub}</div>
        </div>
        <button
          onClick={onOpen}
          className="shrink-0 font-mono text-[10px] text-faint transition-colors hover:text-volt"
        >
          alle {rows.length} →
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="py-6 text-center font-mono text-xs text-faint">ingen data endnu</div>
      ) : (
        <ol className="space-y-0.5">
          {rows.slice(0, 10).map((r, i) => (
            <Row key={`${r.p.n}-${r.p.t}-${i}`} i={i} p={r.p} v={spec.fmt(r.v)} hint={spec.hint?.(r.p)} />
          ))}
        </ol>
      )}
    </div>
  );
}

function FullListModal({
  spec,
  rows,
  onClose,
}: {
  spec: Spec;
  rows: { p: DashPlayer; v: number }[];
  onClose: () => void;
}) {
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

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[8vh]">
      <button
        aria-label="Luk"
        onClick={onClose}
        className={`absolute inset-0 cursor-default bg-black/30 backdrop-blur-md transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line-2 bg-panel/95 shadow-2xl shadow-black/40 transition duration-200 ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <div className="font-display text-base font-bold text-fg">{spec.title}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-faint">
              {spec.sub} · {rows.length} spillere
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-line-2 px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:text-fg"
          >
            esc
          </button>
        </div>
        <ol className="overflow-y-auto p-2">
          {rows.slice(0, FULL_CAP).map((r, i) => (
            <Row key={`${r.p.n}-${r.p.t}-${i}`} i={i} p={r.p} v={spec.fmt(r.v)} hint={spec.hint?.(r.p)} big />
          ))}
          {rows.length > FULL_CAP && (
            <li className="px-2 py-3 text-center font-mono text-[11px] text-faint">
              viser top {FULL_CAP} af {rows.length}
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}

function Row({
  i,
  p,
  v,
  hint,
  big,
}: {
  i: number;
  p: DashPlayer;
  v: string;
  hint?: string;
  big?: boolean;
}) {
  const pos = primaryPos(p.pos);
  return (
    <li>
      <button
        onClick={() => openPlayer(`${p.t}::${p.n}`)}
        className={`flex w-full items-center gap-2 rounded-md px-1.5 text-left text-sm transition-colors hover:bg-panel/60 ${big ? "py-1.5" : "py-1"}`}
      >
        <span className="tnum w-6 shrink-0 text-right font-mono text-[11px] text-faint">{i + 1}</span>
        <Crest team={p.t} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-fg">{p.n}</span>
          <span className="block truncate font-mono text-[10px] text-faint">
            {p.t}
          </span>
          <span className="block font-mono text-[10px] text-faint">
            {LEAGUE_ABBR(p.lg)}
            {pos && <span className="ml-1 text-muted">· {pos}</span>}
          </span>
        </span>
        {hint && <span className="w-10 shrink-0 text-right font-mono text-[10px] text-muted">{hint}</span>}
        <span className="tnum w-12 shrink-0 text-right font-mono text-sm font-semibold text-volt">{v}</span>
      </button>
    </li>
  );
}

function Crest({ team }: { team: string }) {
  const [ok, setOk] = useState(true);
  const url = teamLogoUrl(team);
  if (!url || !ok) return <span className="inline-block h-4 w-4 shrink-0" aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" onError={() => setOk(false)} loading="lazy" className="h-4 w-4 shrink-0 object-contain" />
  );
}
