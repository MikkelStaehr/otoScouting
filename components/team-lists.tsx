"use client";

import { useEffect, useMemo, useState } from "react";
import { teamLogoUrl } from "@/lib/team-logos";
import { leagueFlagUrl } from "@/lib/flags";
import { openTeam } from "./team-modal";

export interface DashTeam {
  n: string;
  lg: string;
  matches: number;
  rating: number | null;
  m: Record<string, number | null>;
}

const LEAGUE_ABBR = (lg: string) => lg.slice(0, 3);
const FULL_CAP = 250;
const f2 = (v: number) => v.toFixed(2);
const pct1 = (v: number) => `${v.toFixed(1)}%`;

interface TSpec {
  key: string;
  title: string;
  sub: string;
  pick: (t: DashTeam) => number | null;
  fmt: (v: number) => string;
  asc?: boolean; // lower is better (defensive lists)
}

const tper = (k: string) => (t: DashTeam) => t.m[k] ?? null;

const SPECS: TSpec[] = [
  { key: "attack", title: "Bedste angreb", sub: "mål /kamp", pick: tper("goals"), fmt: f2 },
  { key: "xg", title: "Flest xG", sub: "xG /kamp", pick: tper("xg"), fmt: f2 },
  {
    key: "clinical", title: "Skarpest foran mål", sub: "mål over xG /kamp",
    pick: (t) => (t.m.goals != null && t.m.xg != null ? t.m.goals - t.m.xg : null),
    fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`,
  },
  { key: "bigchances", title: "Flest store chancer", sub: "big chances /kamp", pick: tper("big_chances"), fmt: f2 },
  { key: "possession", title: "Mest bold", sub: "boldbesiddelse %", pick: tper("possession"), fmt: pct1 },
  { key: "passing", title: "Bedste opspil", sub: "afleveringspræcision %", pick: tper("pass_pct"), fmt: pct1 },
  { key: "defense", title: "Bedste forsvar", sub: "mål imod /kamp (lavest)", pick: tper("goals_conceded"), fmt: f2, asc: true },
  { key: "solid", title: "Færrest skud imod", sub: "skud imod /kamp (lavest)", pick: tper("shots_against"), fmt: f2, asc: true },
  { key: "clean", title: "Renest", sub: "clean sheets /kamp", pick: tper("clean_sheets"), fmt: f2 },
  { key: "rating", title: "Højest rating", sub: "gns. Sofascore-rating", pick: (t) => t.rating, fmt: (v) => v.toFixed(2) },
];

export function TeamLists({ teams }: { teams: DashTeam[] }) {
  const [open, setOpen] = useState<string | null>(null);

  const ranked = useMemo(() => {
    const map: Record<string, { t: DashTeam; v: number }[]> = {};
    for (const s of SPECS) {
      map[s.key] = teams
        .map((t) => ({ t, v: s.pick(t) }))
        .filter((x): x is { t: DashTeam; v: number } => x.v != null)
        .sort((a, b) => (s.asc ? a.v - b.v : b.v - a.v));
    }
    return map;
  }, [teams]);

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

function Card({ spec, rows, onOpen }: { spec: TSpec; rows: { t: DashTeam; v: number }[]; onOpen: () => void }) {
  return (
    <div className="flex flex-col rounded-xl border border-line bg-panel/30 p-3.5">
      <div className="mb-2 flex items-start justify-between border-b border-line/60 pb-2">
        <div>
          <div className="font-display text-sm font-bold text-fg">{spec.title}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-faint">{spec.sub}</div>
        </div>
        <button onClick={onOpen} className="shrink-0 font-mono text-[10px] text-faint transition-colors hover:text-volt">
          alle {rows.length} →
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="py-6 text-center font-mono text-xs text-faint">ingen data endnu</div>
      ) : (
        <ol className="space-y-0.5">
          {rows.slice(0, 10).map((r, i) => (
            <Row key={`${r.t.n}-${i}`} i={i} t={r.t} v={spec.fmt(r.v)} />
          ))}
        </ol>
      )}
    </div>
  );
}

function FullListModal({ spec, rows, onClose }: { spec: TSpec; rows: { t: DashTeam; v: number }[]; onClose: () => void }) {
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
      <button aria-label="Luk" onClick={onClose} className={`absolute inset-0 cursor-default bg-black/30 backdrop-blur-md transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`} />
      <div className={`relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line-2 bg-panel/95 shadow-2xl shadow-black/40 transition duration-200 ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <div className="font-display text-base font-bold text-fg">{spec.title}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-faint">{spec.sub} · {rows.length} hold</div>
          </div>
          <button onClick={onClose} className="rounded-md border border-line-2 px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:text-fg">esc</button>
        </div>
        <ol className="overflow-y-auto p-2">
          {rows.slice(0, FULL_CAP).map((r, i) => (
            <Row key={`${r.t.n}-${i}`} i={i} t={r.t} v={spec.fmt(r.v)} big />
          ))}
        </ol>
      </div>
    </div>
  );
}

function Row({ i, t, v, big }: { i: number; t: DashTeam; v: string; big?: boolean }) {
  return (
    <li>
      <button
        onClick={() => openTeam(t.lg, t.n)}
        title="Se forsvars-svagheder + fit-forslag"
        className={`flex w-full items-center gap-2 rounded-md px-1.5 text-left text-sm transition-colors hover:bg-panel/60 ${big ? "py-1.5" : "py-1"}`}
      >
        <span className="tnum w-6 shrink-0 text-right font-mono text-[11px] text-faint">{i + 1}</span>
        <Crest team={t.n} />
        <span className="min-w-0 flex-1 truncate">
          <span className="text-fg">{t.n}</span>
          <span className="ml-1.5 font-mono text-[10px] text-faint">
            {leagueFlagUrl(t.lg) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={leagueFlagUrl(t.lg)!} alt="" className="mr-1 inline-block h-2 w-auto rounded-[1px] align-middle" />
            )}
            {LEAGUE_ABBR(t.lg)}
          </span>
        </span>
        <span className="tnum shrink-0 font-mono text-xs font-semibold text-volt">{v}</span>
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
