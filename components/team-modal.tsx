"use client";

import { useCallback, useEffect, useState } from "react";
import { teamLogoUrl } from "@/lib/team-logos";
import { openPlayer } from "./player-modal";

const OPEN_EVENT = "otoscout:open-team";

/** Open the team weakness modal from anywhere (team lists / table). */
export function openTeam(league: string, team: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { league, team } }));
}

interface Fit {
  key: string; player: string; team: string; league: string;
  strength: number; minutes: number; age: number | null;
}
interface ZoneCover {
  zone: string; side: string; player: string; key: string;
  minutes: number; strength: number | null;
  metrics: { label: string; pct: number | null }[];
  fits: Fit[];
}
interface TeamWeakness {
  team: string; league: string; zones: ZoneCover[];
  goalsAgainst: number | null; bigChancesAgainst: number | null;
}

const strColor = (s: number | null) =>
  s == null ? "var(--color-faint)" : s >= 62 ? "rgba(77,124,90,1)" : s >= 48 ? "var(--color-muted)" : "rgba(180,105,74,1)";

export function TeamModal() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [detail, setDetail] = useState<TeamWeakness | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (league: string, team: string) => {
    setLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/team?league=${encodeURIComponent(league)}&team=${encodeURIComponent(team)}`);
      const d = (await res.json()) as TeamWeakness & { error?: string };
      if (!d.error) setDetail(d);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setMounted(false);
      setDetail(null);
    }, 180);
  }, []);

  useEffect(() => {
    function onOpen(e: Event) {
      const d = (e as CustomEvent<{ league: string; team: string }>).detail;
      if (!d) return;
      setMounted(true);
      requestAnimationFrame(() => setVisible(true));
      load(d.league, d.team);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [load, close]);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  if (!mounted) return null;
  const weakest = detail
    ? [...detail.zones].filter((z) => z.strength != null).sort((a, b) => a.strength! - b.strength!)[0]
    : null;

  return (
    <div className="fixed inset-0 z-[64] flex items-start justify-center px-4 pt-[7vh]">
      <button
        aria-label="Luk"
        onClick={close}
        className={`absolute inset-0 cursor-default bg-black/35 backdrop-blur-md transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line-2 bg-panel/95 shadow-2xl shadow-black/50 transition duration-200 ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Crest team={detail?.team ?? ""} big />
            <div>
              <h2 className="font-display text-xl font-bold text-fg">
                {detail?.team ?? (loading ? "…" : "")}
              </h2>
              {detail && (
                <div className="mt-0.5 font-mono text-[11px] text-muted">
                  forsvars-svagheder · {detail.goalsAgainst ?? "—"} mål imod/kamp
                  {detail.bigChancesAgainst != null && ` · ${detail.bigChancesAgainst} store chancer imod/kamp`}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={close}
            className="rounded-md border border-line-2 px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:text-fg"
          >
            esc
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {!detail ? (
            <div className="py-10 text-center font-mono text-sm text-faint">henter…</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {detail.zones.map((z) => (
                <Zone key={z.side} z={z} weakest={weakest?.side === z.side} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Zone({ z, weakest }: { z: ZoneCover; weakest: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${weakest ? "border-[rgba(180,105,74,0.5)] bg-[rgba(180,105,74,0.06)]" : "border-line bg-panel/30"}`}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-faint">{z.zone}</span>
        {weakest && <span className="font-mono text-[9px] uppercase tracking-wider text-[rgba(180,105,74,1)]">svagest</span>}
      </div>
      {z.player === "—" ? (
        <div className="py-4 text-center font-mono text-xs text-faint">ingen data</div>
      ) : (
        <>
          <button
            onClick={() => z.key && openPlayer(z.key)}
            className="flex w-full items-baseline justify-between text-left"
          >
            <span className="truncate text-sm font-medium text-fg hover:text-volt">{z.player}</span>
            <span className="tnum ml-2 shrink-0 font-mono text-lg font-bold" style={{ color: strColor(z.strength) }}>
              {z.strength ?? "—"}
            </span>
          </button>
          <div className="mt-2 space-y-1">
            {z.metrics.map((m) => (
              <div key={m.label} className="flex items-center gap-1.5">
                <span className="w-16 shrink-0 truncate font-mono text-[9px] text-muted">{m.label}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-2">
                  {m.pct != null && (
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${m.pct}%`, backgroundColor: m.pct >= 50 ? "rgba(77,124,90,0.85)" : "rgba(180,105,74,0.85)" }}
                    />
                  )}
                </div>
                <span className="tnum w-5 shrink-0 text-right font-mono text-[9px] text-faint">
                  {m.pct != null ? Math.round(m.pct) : "—"}
                </span>
              </div>
            ))}
          </div>

          {z.fits.length > 0 && (
            <div className="mt-3 border-t border-line/60 pt-2">
              <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-volt">Opgraderinger</div>
              <div className="space-y-0.5">
                {z.fits.slice(0, 4).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => openPlayer(f.key)}
                    className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-panel/60"
                  >
                    <Crest team={f.team} />
                    <span className="min-w-0 flex-1 truncate text-xs text-fg">
                      {f.player}
                      <span className="ml-1 font-mono text-[9px] text-faint">
                        {f.league.slice(0, 3)}{f.age != null && ` · ${f.age}`}
                      </span>
                    </span>
                    <span className="tnum shrink-0 font-mono text-[11px] font-semibold text-volt">{f.strength}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Crest({ team, big }: { team: string; big?: boolean }) {
  const [ok, setOk] = useState(true);
  const url = teamLogoUrl(team);
  const sz = big ? "h-6 w-6" : "h-3.5 w-3.5";
  if (!url || !ok) return <span className={`inline-block shrink-0 ${sz}`} aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" onError={() => setOk(false)} loading="lazy" className={`shrink-0 object-contain ${sz}`} />
  );
}
