"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { teamLogoUrl } from "@/lib/team-logos";
import { openPlayer } from "./player-modal";

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
  key: string; player: string; pos: string | null;
  mp: number; minutes: number;
  values: (number | null)[]; pcts: (number | null)[];
}
interface SquadGroup { group: string; label: string; cols: SquadCol[]; rows: SquadRow[] }
interface TeamReport {
  team: string; league: string; season_label: string;
  matches: number | null; rating: number | null;
  ratingRank: number | null; teamsInLeague: number;
  metrics: MetricReport[]; strengths: MetricReport[]; weaknesses: MetricReport[];
  squad: SquadGroup[];
  zones: ZoneCover[];
  goalsAgainst: number | null; bigChancesAgainst: number | null;
}

const strColor = (s: number | null) =>
  s == null ? "var(--color-faint)" : s >= 62 ? "rgba(77,124,90,1)" : s >= 48 ? "var(--color-muted)" : "rgba(180,105,74,1)";

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
  const bodyRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (league: string, team: string) => {
    setLoading(true);
    setDetail(null);
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
  const weakest = detail
    ? [...detail.zones].filter((z) => z.strength != null).sort((a, b) => a.strength! - b.strength!)[0]
    : null;
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
        className={`relative flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line-2 bg-panel/95 shadow-2xl shadow-black/50 transition duration-200 ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
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

        {/* body */}
        <div ref={bodyRef} className="overflow-y-auto p-6">
          {!detail ? (
            <div className="py-16 text-center font-mono text-sm text-faint">henter…</div>
          ) : (
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

              {/* strengths / weaknesses */}
              {(detail.strengths.length > 0 || detail.weaknesses.length > 0) && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SwCard title="Styrker" tone="good" items={detail.strengths} of={detail.teamsInLeague} />
                  <SwCard title="Svagheder" tone="bad" items={detail.weaknesses} of={detail.teamsInLeague} />
                </div>
              )}

              {/* metrics + zones */}
              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                    <MetricGroup title="Offensive nøgletal" metrics={off} of={detail.teamsInLeague} />
                    <MetricGroup title="Defensive nøgletal" metrics={def} of={detail.teamsInLeague} />
                  </div>
                </div>

                <div className="lg:col-span-5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-volt">Forsvarszoner</span>
                    <span className="font-mono text-[10px] text-faint">svaghed → upgrade-forslag</span>
                  </div>
                  <div className="space-y-2.5">
                    {detail.zones.map((z) => (
                      <Zone key={z.side} z={z} weakest={weakest?.side === z.side} />
                    ))}
                  </div>
                  <p className="mt-2 font-mono text-[10px] leading-relaxed text-faint">
                    Zonen dækkes af holdets mest brugte back i den side; tal = defensiv
                    percentil. Opgraderinger er stærkere backs i samme side på tværs af ligaer.
                  </p>
                </div>
              </div>

              {/* squad — players by line with position-appropriate key stats */}
              {detail.squad.length > 0 && (
                <div className="mt-6 border-t border-line pt-5">
                  <div className="mb-3 flex items-baseline justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-volt">Trup</span>
                    <span className="font-mono text-[10px] text-faint">nøgletal pr. 90 · efter position · klik for spillerkort</span>
                  </div>
                  <div className="space-y-4">
                    {detail.squad.map((g) => (
                      <SquadTable key={g.group} g={g} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
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

function Zone({ z, weakest }: { z: ZoneCover; weakest: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${weakest ? "border-[rgba(180,105,74,0.5)] bg-[rgba(180,105,74,0.06)]" : "border-line bg-panel/30"}`}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-faint">{z.zone}</span>
        {weakest && <span className="font-mono text-[9px] uppercase tracking-wider text-[rgba(180,105,74,1)]">svagest</span>}
      </div>
      {z.player === "—" ? (
        <div className="py-3 text-center font-mono text-xs text-faint">ingen data</div>
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
          <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
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
              <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
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

const cellBg = (pct: number | null): React.CSSProperties | undefined => {
  if (pct == null) return undefined;
  const a = (Math.abs(pct - 50) / 50) * 0.22;
  return { backgroundColor: pct >= 50 ? `rgba(77,124,90,${a})` : `rgba(180,105,74,${a})` };
};
const fmtCell = (v: number | null, rate: boolean): string =>
  v == null ? "—" : rate ? `${v.toFixed(0)}%` : v.toFixed(2);

function SquadTable({ g }: { g: SquadGroup }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-ink-2">
            <th className="px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-volt">
              {g.label}
            </th>
            <th className="px-2 py-1.5 text-right font-mono text-[10px] uppercase tracking-wider text-faint" title="Kampe">K</th>
            <th className="px-2 py-1.5 text-right font-mono text-[10px] uppercase tracking-wider text-faint">Min</th>
            {g.cols.map((c) => (
              <th key={c.key} className="px-2 py-1.5 text-right font-mono text-[10px] uppercase tracking-wider text-faint">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {g.rows.map((r) => (
            <tr key={r.key} className="border-t border-line/50 transition-colors hover:bg-panel/50">
              <td className="whitespace-nowrap px-3 py-1.5">
                <button onClick={() => openPlayer(r.key)} className="text-left font-medium text-fg transition-colors hover:text-volt">
                  {r.player}
                </button>
                {r.pos && <span className="ml-1.5 font-mono text-[9px] text-faint">{r.pos}</span>}
              </td>
              <td className="px-2 py-1.5 text-right tnum text-muted">{r.mp}</td>
              <td className="px-2 py-1.5 text-right tnum text-faint">{r.minutes}</td>
              {r.values.map((v, i) => (
                <td key={i} className="px-2 py-1.5 text-right tnum text-fg" style={cellBg(r.pcts[i] ?? null)}>
                  {fmtCell(v, g.cols[i]!.rate)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
