"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { teamLogoUrl } from "@/lib/team-logos";
import { flagUrl } from "@/lib/flags";
import { openPlayer } from "./player-modal";
import { PitchHeatmap } from "./pitch-heatmap";
import { ZonePitch } from "./zone-pitch";
import { FormationPitch, type Dot } from "./formation-pitch";
import { roleDesc } from "@/lib/role-meta";
import { WatchlistButton } from "./watchlist";

const OPEN_EVENT = "otoscout:open-team";

/** Open the team report modal from anywhere (team lists / table). */
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
interface MetricReport {
  key: string; label: string; group: "off" | "def";
  value: number | null; pct: number | null; rank: number | null; of: number; rate: boolean;
}
interface SquadCol { key: string; label: string; rate: boolean }
interface SquadRow {
  key: string; player: string; pos: string | null; nation: string | null; role: string | null;
  mp: number; minutes: number; out: number | null;
  values: (number | null)[]; pcts: (number | null)[];
}
interface SquadGroup { group: string; label: string; cols: SquadCol[]; rows: SquadRow[] }
interface RoleSlot { role: string; bucket: string; players: { key: string; player: string; out: number | null }[]; bestOut: number | null }
interface RoleUpgrade { role: string; currentPlayer: string | null; currentOut: number | null; reason: "kvalitet" | "dybde" | "begge"; candidates: { key: string; player: string; team: string; league: string; out: number | null; age: number | null }[] }
interface Formation { formation: string; n: number; pct: number }
interface StyleFit { style: string; conf: number; why: string[] }
interface StyleResult { primary: StyleFit | null; secondary: StyleFit | null }
interface TeamStyle { ip: StyleResult; oop: StyleResult }
interface TeamReport {
  team: string; league: string; season_label: string;
  matches: number | null; rating: number | null;
  ratingRank: number | null; teamsInLeague: number;
  metrics: MetricReport[]; strengths: MetricReport[]; weaknesses: MetricReport[];
  squad: SquadGroup[];
  roleMakeup: RoleSlot[];
  roleUpgrades: RoleUpgrade[];
  formations: Formation[];
  style: TeamStyle | null;
  positions: Dot[];
  heatmap: { w: number; h: number; grid: number[] } | null;
  zones: ZoneCover[];
  goalsAgainst: number | null; bigChancesAgainst: number | null;
}

const pctColor = (p: number | null) =>
  p == null ? "rgba(120,120,120,0.4)" : p >= 50 ? "rgba(77,124,90,0.9)" : "rgba(180,105,74,0.9)";

const fmtMetric = (m: MetricReport): string => {
  if (m.value == null) return "—";
  return m.rate ? `${m.value.toFixed(1)}%` : m.value.toFixed(2);
};

const ord = (n: number) => `${n}.`;

export function TeamModal() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [detail, setDetail] = useState<TeamReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"report" | "squad" | "roles">("report");
  const [phase, setPhase] = useState<"all" | "att" | "def">("all");
  const [mapView, setMapView] = useState<"form" | "zone">("form");
  const bodyRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (league: string, team: string) => {
    setLoading(true);
    setDetail(null);
    setTab("report");
    setPhase("all");
    try {
      const res = await fetch(`/api/team?league=${encodeURIComponent(league)}&team=${encodeURIComponent(team)}`);
      const d = (await res.json()) as TeamReport & { error?: string };
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
  const off = detail?.metrics.filter((m) => m.group === "off") ?? [];
  const def = detail?.metrics.filter((m) => m.group === "def") ?? [];

  return (
    <div className="fixed inset-0 z-[64] flex items-start justify-center px-4 pt-[6vh]">
      <button
        aria-label="Luk"
        onClick={close}
        className={`absolute inset-0 cursor-default bg-black/35 backdrop-blur-md transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`relative flex max-h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-line-2 bg-panel/95 shadow-2xl shadow-black/50 transition duration-200 ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
      >
        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <Crest team={detail?.team ?? ""} big />
            <div>
              <h2 className="font-display text-2xl font-bold text-fg">
                {detail?.team ?? (loading ? "…" : "")}
              </h2>
              {detail && (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted">
                  <span>{detail.league.replace("-", " · ")}</span>
                  {detail.season_label && <span className="text-faint">· {detail.season_label}</span>}
                  {detail.matches != null && <span className="text-faint">· {detail.matches} kampe</span>}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {detail?.rating != null && (
              <div className="text-right">
                <div className="tnum text-2xl font-bold text-volt">{detail.rating.toFixed(2)}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-faint">
                  rating{detail.ratingRank != null && ` · ${ord(detail.ratingRank)} af ${detail.teamsInLeague}`}
                </div>
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

        {/* tabs */}
        {detail && (
          <div className="flex gap-1 border-b border-line px-6 pt-2">
            {([["report", "Rapport"], ["squad", `Trup${detail.squad.length ? ` · ${detail.squad.reduce((a, g) => a + g.rows.length, 0)}` : ""}`], ["roles", "Roller"]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => { setTab(k); bodyRef.current?.scrollTo({ top: 0 }); }}
                className={`-mb-px border-b-2 px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                  tab === k ? "border-volt text-fg" : "border-transparent text-muted hover:text-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* body */}
        <div ref={bodyRef} className="overflow-y-auto p-6">
          {!detail ? (
            <div className="py-16 text-center font-mono text-sm text-faint">henter…</div>
          ) : tab === "report" ? (
            <>
              {/* KPI strip */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                <Kpi label="Rating" value={detail.rating?.toFixed(2) ?? "—"} rank={detail.ratingRank} of={detail.teamsInLeague} accent />
                <KpiMetric m={off.find((m) => m.key === "goals")} label="Mål /kamp" of={detail.teamsInLeague} />
                <KpiMetric m={off.find((m) => m.key === "xg")} label="xG /kamp" of={detail.teamsInLeague} />
                <KpiMetric m={def.find((m) => m.key === "goals_conceded")} label="Mål imod /kamp" of={detail.teamsInLeague} />
                <KpiMetric m={def.find((m) => m.key === "big_chances_against")} label="Store ch. imod" of={detail.teamsInLeague} />
                <KpiMetric m={def.find((m) => m.key === "clean_sheets")} label="Clean sheets" of={detail.teamsInLeague} />
              </div>

              {/* formations (top few this season) */}
              {detail.formations.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Formationer</span>
                  {detail.formations.slice(0, 3).map((f, i) => (
                    <span key={f.formation} className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-panel/40 px-2.5 py-1">
                      <span className={`font-mono text-sm ${i === 0 ? "font-bold text-fg" : "text-muted"}`}>{f.formation}</span>
                      <span className="font-mono text-[10px] text-faint">{f.pct}% · {f.n}×</span>
                    </span>
                  ))}
                  <span className="font-mono text-[10px] text-faint">mest brugte opstillinger i sæsonen</span>
                </div>
              )}

              {/* playing style — in / out of possession */}
              {detail.style && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <StyleCard label="Med bolden" res={detail.style.ip} />
                  <StyleCard label="Uden bolden" res={detail.style.oop} />
                </div>
              )}

              {/* strengths / weaknesses */}
              {(detail.strengths.length > 0 || detail.weaknesses.length > 0) && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SwCard title="Styrker" tone="good" items={detail.strengths} of={detail.teamsInLeague} />
                  <SwCard title="Svagheder" tone="bad" items={detail.weaknesses} of={detail.teamsInLeague} />
                </div>
              )}

              {/* metrics (left, stacked) + map card (right) — both capped so the
                  stacked bars don't stretch the full modal width */}
              <div className="mt-5 flex flex-col gap-8 lg:flex-row lg:items-start">
                <div className="w-full space-y-5 lg:max-w-sm lg:flex-1">
                  <MetricGroup title="Offensive nøgletal" metrics={off} of={detail.teamsInLeague} />
                  <MetricGroup title="Defensive nøgletal" metrics={def} of={detail.teamsInLeague} />
                </div>

                <div className="w-full lg:w-[340px] lg:shrink-0">
                  {detail.heatmap && (() => {
                    const hasForm = detail.positions.length > 0;
                    const formLabel = hasForm ? "Opstilling" : "Heatmap";
                    return (
                      <div>
                        {/* view toggle (opstilling ↔ zoner) + phase toggle when relevant */}
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <div className="inline-flex overflow-hidden rounded-md border border-line-2">
                            {([["form", formLabel], ["zone", "Zoner"]] as const).map(([k, label]) => (
                              <button
                                key={k}
                                onClick={() => setMapView(k)}
                                className={`px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                                  mapView === k ? "bg-volt text-ink" : "bg-transparent text-muted hover:text-fg"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {mapView === "form" && hasForm && (
                            <div className="inline-flex overflow-hidden rounded-md border border-line-2">
                              {([["all", "Samlet"], ["att", "Angreb"], ["def", "Forsvar"]] as const).map(([k, label]) => (
                                <button
                                  key={k}
                                  onClick={() => setPhase(k)}
                                  className={`px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                                    phase === k ? "bg-volt text-ink" : "bg-transparent text-muted hover:text-fg"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {mapView === "form" ? (
                          hasForm ? (
                            <>
                              <FormationPitch
                                hm={detail.heatmap}
                                dots={detail.positions}
                                formation={detail.formations[0]?.formation ?? null}
                                phase={phase}
                                onPick={openPlayer}
                              />
                              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-faint">
                                <span>typisk 11'er · farve = OUT</span>
                                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "rgba(77,124,90,0.95)" }} /> høj</span>
                                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "rgba(180,105,74,0.95)" }} /> lav</span>
                                {phase !== "all" && <span>· {phase === "att" ? "høje" : "dybe"} positioner (afledt af heatmap, ikke ægte possessions-faser)</span>}
                              </p>
                            </>
                          ) : (
                            <>
                              <PitchHeatmap hm={detail.heatmap} id="team-hm" />
                              <p className="mt-1.5 font-mono text-[10px] text-faint">
                                markspillernes sæson-heatmaps lagt sammen, vægtet efter spilletid
                              </p>
                            </>
                          )
                        ) : (
                          <>
                            <ZonePitch hm={detail.heatmap} id="team-zone" />
                            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-faint">
                              Banen delt i 3×3 zoner; tal = andel af holdets samlede aktivitet i hver zone.
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </>
          ) : tab === "squad" ? (
            /* squad tab — players by line with position-appropriate key stats */
            <>
              {detail.squad.length === 0 ? (
                <div className="py-16 text-center font-mono text-sm text-faint">ingen trup-data</div>
              ) : (
                <>
                  <div className="mb-3 flex items-baseline justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-volt">Trup</span>
                    <span className="font-mono text-[10px] text-faint">nøgletal pr. 90 · min/kamp · OUT · klik for spillerkort</span>
                  </div>
                  <div className="space-y-4">
                    {detail.squad.map((g) => (
                      <SquadTable key={g.group} g={g} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            /* roles tab — role composition + upgrade targets */
            <RolesTab makeup={detail.roleMakeup} upgrades={detail.roleUpgrades} />
          )}
        </div>
      </div>
    </div>
  );
}

const outClr = (o: number | null) =>
  o == null ? "var(--color-faint)" : o >= 62 ? "rgba(77,124,90,1)" : o >= 48 ? "var(--color-muted)" : "rgba(180,105,74,1)";

function RolesTab({ makeup, upgrades }: { makeup: RoleSlot[]; upgrades: RoleUpgrade[] }) {
  if (!makeup.length) return <div className="py-16 text-center font-mono text-sm text-faint">ingen rolle-data</div>;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* composition */}
      <div className="lg:col-span-7">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-volt">Rolle-sammensætning</span>
          <span className="font-mono text-[10px] text-faint">hvilke profiler holdet har</span>
        </div>
        <div className="space-y-1.5">
          {makeup.map((s) => (
            <div key={s.role} className="flex items-center gap-2 rounded-lg border border-line bg-panel/30 px-3 py-2">
              <span className="w-14 shrink-0 font-mono text-[9px] uppercase tracking-wider text-faint">{s.bucket}</span>
              <span className="w-40 shrink-0 truncate text-sm font-medium text-fg" title={roleDesc(s.role)}>{s.role}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">
                {s.players.map((p, i) => (
                  <span key={p.key}>
                    {i > 0 && ", "}
                    <button onClick={() => openPlayer(p.key)} className="transition-colors hover:text-volt">{p.player.split(" ").slice(-1)[0]}</button>
                  </span>
                ))}
              </span>
              <span className="tnum shrink-0 font-mono text-sm font-bold" style={{ color: outClr(s.bestOut) }}>{s.bestOut ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* transfer targets */}
      <div className="lg:col-span-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-volt">Transfer targets</span>
          <span className="font-mono text-[10px] text-faint">roller med behov → bedre profiler</span>
        </div>
        {upgrades.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-panel/20 px-4 py-8 text-center font-mono text-[11px] leading-relaxed text-faint">
            ingen oplagte behov<br />truppen er dækket ind på kvalitet og dybde
          </div>
        ) : (
        <div className="space-y-2.5">
          {upgrades.map((u) => (
            <div key={u.role} className="rounded-xl border border-line bg-panel/30 p-3">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="flex items-baseline gap-1.5 truncate">
                  <span className="truncate text-sm font-medium text-fg" title={roleDesc(u.role)}>{u.role}</span>
                  <span className="shrink-0 font-mono text-[8px] uppercase tracking-wider text-clay" title={reasonHint(u.reason)}>{reasonLabel(u.reason)}</span>
                </span>
                <span className="shrink-0 font-mono text-[10px] text-faint">nu: {u.currentPlayer?.split(" ").slice(-1)[0]} <span style={{ color: outClr(u.currentOut) }}>{u.currentOut}</span></span>
              </div>
              {u.candidates.length === 0 ? (
                <div className="py-1 font-mono text-[10px] text-faint">ingen klare opgraderinger</div>
              ) : (
                <div className="space-y-0.5">
                  {u.candidates.slice(0, 4).map((c) => (
                    <div key={c.key} className="flex items-center gap-1.5">
                      <WatchlistButton target={{ sid: null, key: c.key, n: c.player, t: c.team, lg: c.league }} />
                      <button onClick={() => openPlayer(c.key)} className="min-w-0 flex-1 truncate text-left text-xs text-fg transition-colors hover:text-volt">
                        {c.player}
                        <span className="ml-1 font-mono text-[9px] text-faint">{c.team} · {c.league.slice(0, 3)}{c.age != null && ` · ${c.age}`}</span>
                      </button>
                      <span className="tnum shrink-0 font-mono text-[11px] font-semibold text-volt">{c.out}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}

const reasonLabel = (r: RoleUpgrade["reason"]) => (r === "kvalitet" ? "svag profil" : r === "dybde" ? "tynd trup" : "svag + tynd");
const reasonHint = (r: RoleUpgrade["reason"]) =>
  r === "kvalitet" ? "bedste spiller i rollen er under liga-medianen" : r === "dybde" ? "for få spillere på denne kædeposition" : "både svag profil og tynd trup";

function StyleCard({ label, res }: { label: string; res: StyleResult }) {
  if (!res.primary) return null;
  return (
    <div className="rounded-xl border border-line bg-panel/30 p-3">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-faint">{label}</div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-display text-base font-bold text-fg">{res.primary.style}</span>
        <span className="tnum font-mono text-[11px] text-volt">{res.primary.conf}%</span>
        {res.secondary && (
          <span className="font-mono text-[11px] text-muted">· {res.secondary.style} {res.secondary.conf}%</span>
        )}
      </div>
      {res.primary.why.length > 0 && (
        <div className="mt-1 font-mono text-[10px] leading-relaxed text-faint">{res.primary.why.join(" · ")}</div>
      )}
    </div>
  );
}

function Kpi({ label, value, rank, of, accent }: { label: string; value: string; rank: number | null; of: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-panel/30 px-3 py-2.5">
      <div className={`tnum text-xl font-bold ${accent ? "text-volt" : "text-fg"}`}>{value}</div>
      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-faint">{label}</div>
      {rank != null && (
        <div className="mt-1 font-mono text-[10px] text-muted">
          {ord(rank)} af {of}
        </div>
      )}
    </div>
  );
}

function KpiMetric({ m, label, of }: { m: MetricReport | undefined; label: string; of: number }) {
  return <Kpi label={label} value={m ? fmtMetric(m) : "—"} rank={m?.rank ?? null} of={m?.of ?? of} />;
}

function SwCard({ title, tone, items, of }: { title: string; tone: "good" | "bad"; items: MetricReport[]; of: number }) {
  const color = tone === "good" ? "rgba(77,124,90,1)" : "rgba(180,105,74,1)";
  return (
    <div className="rounded-xl border border-line bg-panel/30 p-3">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div className="py-1 font-mono text-[11px] text-faint">ingen markante</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((m) => (
            <span
              key={m.key}
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]"
              style={{ borderColor: `${color.replace(",1)", ",0.4)")}`, backgroundColor: color.replace(",1)", ",0.08)") }}
              title={`${ord(m.rank ?? 0)} af ${m.of} · ${fmtMetric(m)}`}
            >
              <span className="text-fg">{m.label}</span>
              {m.rank != null && <span className="tnum font-mono text-faint">{ord(m.rank)}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricGroup({ title, metrics, of }: { title: string; metrics: MetricReport[]; of: number }) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-volt">{title}</div>
      <div className="space-y-2">
        {metrics.map((m) => (
          <MetricRow key={m.key} m={m} of={of} />
        ))}
      </div>
    </div>
  );
}

function MetricRow({ m, of }: { m: MetricReport; of: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="truncate text-muted">{m.label}</span>
        <span className="tnum shrink-0 pl-2 font-mono text-fg">
          {fmtMetric(m)}
          {m.rank != null && (
            <span className="ml-1.5 text-faint">
              {ord(m.rank)}/{m.of || of}
            </span>
          )}
        </span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-2">
        {m.pct != null && (
          <div className="h-full rounded-full" style={{ width: `${m.pct}%`, backgroundColor: pctColor(m.pct) }} />
        )}
      </div>
    </div>
  );
}

const cellBg = (pct: number | null): React.CSSProperties | undefined => {
  if (pct == null) return undefined;
  const a = (Math.abs(pct - 50) / 50) * 0.22;
  return { backgroundColor: pct >= 50 ? `rgba(77,124,90,${a})` : `rgba(180,105,74,${a})` };
};
const fmtCell = (v: number | null, rate: boolean): string =>
  v == null ? "—" : rate ? `${v.toFixed(0)}%` : v.toFixed(2);

function SquadTable({ g }: { g: SquadGroup }) {
  const hasOut = g.rows.some((r) => r.out != null);
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full table-fixed border-collapse text-sm">
        {/* fixed leading columns so player / rolle / kampe line up across the line tables */}
        <colgroup>
          <col style={{ width: 210 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 60 }} />
        </colgroup>
        <thead>
          <tr className="border-b border-line bg-ink-2">
            <th className="px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-volt">
              {g.label}
            </th>
            <th className="px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-wider text-faint">Rolle</th>
            <th className="px-2 py-1.5 text-right font-mono text-[10px] uppercase leading-tight tracking-wider text-faint" title="Kampe · minutter pr. kamp">
              Kampe<br />min/k
            </th>
            {g.cols.map((c) => (
              <th key={c.key} className="px-2 py-1.5 text-right font-mono text-[10px] uppercase tracking-wider text-faint">
                {c.label}
              </th>
            ))}
            {hasOut && (
              <th className="px-2 py-1.5 text-right font-mono text-[10px] uppercase tracking-wider text-volt" title="Output-score (ligastyrke-justeret)">
                OUT
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {g.rows.map((r) => {
            const perMatch = r.mp > 0 ? Math.round(r.minutes / r.mp) : null;
            return (
              <tr key={r.key} className="border-t border-line/50 transition-colors hover:bg-panel/50">
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <Flag nat={r.nation} />
                    <button onClick={() => openPlayer(r.key)} className="min-w-0 flex-1 truncate text-left font-medium text-fg transition-colors hover:text-volt">
                      {r.player}
                    </button>
                    {r.pos && <span className="shrink-0 font-mono text-[9px] text-faint">{r.pos}</span>}
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5">
                  {r.role ? (
                    <span className="cursor-help font-mono text-[10px] text-muted" title={roleDesc(r.role)}>{r.role}</span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right leading-tight">
                  <div className="tnum text-muted">{r.mp}</div>
                  <div className="tnum font-mono text-[10px] text-faint">{perMatch != null ? `${perMatch}′` : "—"}</div>
                </td>
                {r.values.map((v, i) => (
                  <td key={i} className="px-2 py-1.5 text-right tnum text-fg" style={cellBg(r.pcts[i] ?? null)}>
                    {fmtCell(v, g.cols[i]!.rate)}
                  </td>
                ))}
                {hasOut && (
                  <td className="px-2 py-1.5 text-right tnum font-semibold text-volt">
                    {r.out ?? "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Flag({ nat }: { nat: string | null }) {
  const [ok, setOk] = useState(true);
  if (!nat) return <span className="inline-block h-2.5 w-3.5 shrink-0" aria-hidden />;
  const url = flagUrl(nat);
  if (!url || !ok)
    return <span className="shrink-0 font-mono text-[9px] text-faint">{nat}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={nat} title={nat} onError={() => setOk(false)} className="inline-block h-2.5 w-auto shrink-0 rounded-[1px]" />
  );
}

function Crest({ team, big }: { team: string; big?: boolean }) {
  const [ok, setOk] = useState(true);
  const url = teamLogoUrl(team);
  const sz = big ? "h-7 w-7" : "h-3.5 w-3.5";
  if (!url || !ok) return <span className={`inline-block shrink-0 ${sz}`} aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" onError={() => setOk(false)} loading="lazy" className={`shrink-0 object-contain ${sz}`} />
  );
}
