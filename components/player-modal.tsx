"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flagUrl } from "@/lib/flags";
import { teamLogoUrl } from "@/lib/team-logos";
import { PitchHeatmap } from "./pitch-heatmap";
import { ZonePitch } from "./zone-pitch";
import { WatchlistButton } from "./watchlist";

const OPEN_EVENT = "otoscout:open-player";

/** Open the player detail modal from anywhere (list rows, table, scatter). */
export function openPlayer(key: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { key } }));
}

interface SimStat { key: string; label: string; value: number | null; pct: number | null }
interface SimGroup { label: string; stats: SimStat[] }
interface SimilarPlayer {
  key: string; player: string; team: string; league: string;
  age: number | null; pos: string | null; sim: number;
}
interface HeatmapData { w: number; h: number; grid: number[]; nPoints: number; matches: number | null }
interface PlayerDetail {
  key: string; sid: number | null; player: string; team: string; league: string;
  age: number | null; pos: string | null; posGroup: string;
  nation: string | null; minutes: number; out: number | null;
  heatmap: HeatmapData | null;
  groups: SimGroup[]; similar: SimilarPlayer[];
}

const PCT_KEYS = new Set([
  "pass_pct", "duels_won_pct", "long_ball_pct", "conv_pct", "sot_pct", "gk_save_pct",
]);
const fmtVal = (k: string, v: number | null) =>
  v == null ? "—" : PCT_KEYS.has(k) ? `${Math.round(v)}%` : v.toFixed(2);

export function PlayerModal() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/player?key=${encodeURIComponent(key)}`);
      const d = (await res.json()) as PlayerDetail & { error?: string };
      if (!d.error) {
        setDetail(d);
        bodyRef.current?.scrollTo({ top: 0 });
      }
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
      const key = (e as CustomEvent<{ key: string }>).detail?.key;
      if (!key) return;
      setMounted(true);
      requestAnimationFrame(() => setVisible(true));
      load(key);
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
  const primaryPos = detail?.pos?.split(",")[0]?.trim();

  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center px-4 pt-[7vh]">
      <button
        aria-label="Luk"
        onClick={close}
        className={`absolute inset-0 cursor-default bg-black/35 backdrop-blur-md transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`relative flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line-2 bg-panel/95 shadow-2xl shadow-black/50 transition duration-200 ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
      >
        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <TeamLogo team={detail?.team ?? ""} />
              <h2 className="truncate font-display text-xl font-bold text-fg">
                {detail?.player ?? (loading ? "…" : "")}
              </h2>
            </div>
            {detail && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted">
                <span>{detail.team}</span>
                <span className="text-faint">·</span>
                <span>{detail.league.replace("-", " ")}</span>
                {primaryPos && (
                  <span className="rounded border border-line-2 px-1 text-faint">{primaryPos}</span>
                )}
                {detail.age != null && <span>{detail.age} år</span>}
                <Flag nat={detail.nation} />
                <span className="text-faint">· {detail.minutes} min.</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {detail && (
              <WatchlistButton
                target={{ sid: detail.sid, key: detail.key, n: detail.player, t: detail.team, lg: detail.league }}
                size="md"
              />
            )}
            {detail?.out != null && (
              <div className="text-right">
                <div className="tnum text-2xl font-bold text-volt">{detail.out}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-faint">OUT</div>
              </div>
            )}
            <button
              onClick={close}
              className="rounded-md border border-line-2 px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:text-fg"
            >
              esc
            </button>
          </div>
        </div>

        {/* body */}
        <div ref={bodyRef} className="overflow-y-auto p-5">
          {!detail ? (
            <div className="py-10 text-center font-mono text-sm text-faint">henter…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-12">
                {detail.heatmap && (
                  <div className="lg:col-span-5">
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-volt">
                        Heatmap
                      </span>
                      <span className="font-mono text-[10px] text-faint">
                        {detail.heatmap.matches != null && `${detail.heatmap.matches} kampe`}
                      </span>
                    </div>
                    <PitchHeatmap hm={detail.heatmap} id="player-hm" />

                    <div className="mt-4">
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-volt">Zoneanalyse</span>
                        <span className="font-mono text-[10px] text-faint">andel af aktivitet pr. zone</span>
                      </div>
                      <ZonePitch hm={detail.heatmap} id="player-zone" />
                      <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-faint">
                        Banen delt i 3×3 zoner; tal = andel af hans berøringer i hver zone (fra sæson-heatmappet).
                      </p>
                    </div>
                  </div>
                )}

                <div className={detail.heatmap ? "lg:col-span-7" : "lg:col-span-12"}>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    {detail.groups.map((g) => (
                      <div key={g.label}>
                        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-volt">
                          {g.label}
                        </div>
                        <div className="space-y-1.5">
                          {g.stats.map((s) => (
                            <StatRow key={s.key} stat={s} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* similar players */}
              <div className="mt-6 border-t border-line pt-4">
                <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">
                  Ligner statistisk {detail.posGroup !== "?" && `· ${detail.posGroup}`}
                </div>
                {detail.similar.length === 0 ? (
                  <div className="py-3 font-mono text-xs text-faint">ingen tætte profiler fundet</div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {detail.similar.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => load(s.key)}
                        className="flex items-center gap-2 rounded-lg border border-line-2 bg-ink/40 px-2.5 py-2 text-left text-sm transition-colors hover:border-volt/50"
                      >
                        <TeamLogo team={s.team} />
                        <span className="min-w-0 flex-1 truncate">
                          <span className="text-fg">{s.player}</span>
                          <span className="ml-1.5 font-mono text-[10px] text-faint">
                            {s.team} · {s.league.slice(0, 3)}
                            {s.age != null && ` · ${s.age}`}
                          </span>
                        </span>
                        <span className="tnum shrink-0 font-mono text-xs font-semibold text-volt">
                          {s.sim}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-2 font-mono text-[10px] text-faint">
                  Lighed = hvor ens deres percentil-profiler er (samme rolle, på tværs af ligaer).
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ stat }: { stat: SimStat }) {
  const pct = stat.pct;
  const good = pct != null && pct >= 50;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="truncate text-muted">{stat.label}</span>
        <span className="tnum shrink-0 pl-2 font-mono text-fg">
          {fmtVal(stat.key, stat.value)}
          {pct != null && <span className="ml-1 text-faint">· {Math.round(pct)}</span>}
        </span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-2">
        {pct != null && (
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              backgroundColor: good ? "rgba(77,124,90,0.9)" : "rgba(180,105,74,0.9)",
            }}
          />
        )}
      </div>
    </div>
  );
}

function TeamLogo({ team }: { team: string }) {
  const [ok, setOk] = useState(true);
  const url = teamLogoUrl(team);
  if (!url || !ok) return <span className="inline-block h-5 w-5 shrink-0" aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" onError={() => setOk(false)} loading="lazy" className="h-5 w-5 shrink-0 object-contain" />
  );
}

function Flag({ nat }: { nat: string | null }) {
  const [ok, setOk] = useState(true);
  if (!nat) return null;
  const url = flagUrl(nat);
  if (!url || !ok) return <span className="text-faint">{nat}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={nat} title={nat} onError={() => setOk(false)} className="inline-block h-2.5 w-auto rounded-[1px]" />
  );
}
