"use client";

import { useMemo, useState } from "react";
import type { ShortlistPlayer } from "@/lib/shortlist";
import { SHORTLIST_GROUPS, SIM_KEYS, RATE_METRICS } from "@/lib/shortlist-metrics";
import { METRIC_NAME } from "@/lib/metrics";
import type { MetricKey } from "@/lib/types";
import { flagUrl } from "@/lib/flags";
import { teamLogoUrl } from "@/lib/team-logos";
import { openPlayer } from "./player-modal";
import { WatchlistButton, useWatchlists, watchlists } from "./watchlist";

const LG = (lg: string) => lg.slice(0, 3);
const FILT = "rounded-lg border border-line-2 bg-ink px-2 py-1.5 font-mono text-xs text-fg outline-none focus:border-volt/50";
const fmtVal = (k: string, v: number | null) =>
  v == null ? "—" : RATE_METRICS.has(k) ? `${v.toFixed(0)}%` : v.toFixed(2);
const pctColor = (p: number | null) =>
  p == null ? "rgba(120,120,120,0.35)" : p >= 50 ? "rgba(77,124,90,0.9)" : "rgba(180,105,74,0.9)";

interface Req {
  key: MetricKey;
  min: number;
}

const POS_LABEL: Record<string, string> = { ALL: "Alle positioner", GK: "Målmænd", DF: "Forsvar", MF: "Midtbane", FW: "Angreb" };

function simTo(tpl: ShortlistPlayer, p: ShortlistPlayer): number | null {
  const keys = tpl.isGk ? SIM_KEYS.gk : SIM_KEYS.outfield;
  let sum = 0;
  let n = 0;
  for (const k of keys) {
    const a = tpl.p[k];
    const b = p.p[k];
    if (a != null && b != null) {
      sum += (a - b) ** 2;
      n++;
    }
  }
  if (n < Math.min(6, keys.length)) return null;
  return Math.max(0, Math.round(100 - Math.sqrt(sum / n)));
}

export function ShortlistView({ players, leagues }: { players: ShortlistPlayer[]; leagues: string[] }) {
  const [tab, setTab] = useState<"search" | "watch">("search");
  const [pg, setPg] = useState("ALL");
  const [ageMax, setAgeMax] = useState(40);
  const [minMin, setMinMin] = useState(900);
  const [league, setLeague] = useState("ALL");
  const [reqs, setReqs] = useState<Req[]>([]);
  const [tplKey, setTplKey] = useState<string | null>(null);
  const [tplQuery, setTplQuery] = useState("");
  const [sortBy, setSortBy] = useState<"auto" | "out" | "match" | "sim">("auto");

  const byKey = useMemo(() => new Map(players.map((p) => [p.key, p])), [players]);
  const template = tplKey ? byKey.get(tplKey) ?? null : null;

  // Template search suggestions.
  const tplHits = useMemo(() => {
    const q = tplQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return players
      .filter((p) => p.n.toLowerCase().includes(q) || p.t.toLowerCase().includes(q))
      .slice(0, 8);
  }, [players, tplQuery]);

  const effectiveSort = sortBy === "auto" ? (template ? "sim" : reqs.length ? "match" : "out") : sortBy;

  const results = useMemo(() => {
    const scored = players
      .filter((p) => {
        if (pg !== "ALL" && p.pg !== pg) return false;
        if (p.age != null && p.age > ageMax) return false;
        if (p.min < minMin) return false;
        if (league !== "ALL" && p.lg !== league) return false;
        for (const r of reqs) if ((p.p[r.key] ?? -1) < r.min) return false;
        return true;
      })
      .map((p) => {
        const match = reqs.length
          ? Math.round(reqs.reduce((a, r) => a + (p.p[r.key] ?? 0), 0) / reqs.length)
          : p.out;
        const sim = template && p.key !== template.key ? simTo(template, p) : null;
        return { p, match, sim };
      });
    scored.sort((a, b) => {
      if (effectiveSort === "sim") return (b.sim ?? -1) - (a.sim ?? -1);
      if (effectiveSort === "match") return (b.match ?? -1) - (a.match ?? -1);
      return (b.p.out ?? -1) - (a.p.out ?? -1);
    });
    return scored;
  }, [players, pg, ageMax, minMin, league, reqs, template, effectiveSort]);

  const shown = results.slice(0, 100);

  const addReq = () => {
    const used = new Set(reqs.map((r) => r.key));
    const next = SHORTLIST_GROUPS.flatMap((g) => g.keys).find((k) => !used.has(k));
    if (next) setReqs((r) => [...r, { key: next, min: 60 }]);
  };

  return (
    <div className="space-y-4">
      {/* tabs */}
      <div className="flex gap-1 border-b border-line">
        {([["search", "Søg"], ["watch", "Watchlists"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
              tab === k ? "border-volt text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "watch" ? (
        <WatchTab byKey={byKey} />
      ) : (
        <>
          {/* filter bar */}
          <div className="space-y-3 rounded-2xl border border-line bg-panel/30 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Position">
                <select value={pg} onChange={(e) => setPg(e.target.value)} className={FILT}>
                  {Object.entries(POS_LABEL).map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Liga">
                <select value={league} onChange={(e) => setLeague(e.target.value)} className={FILT}>
                  <option value="ALL">Alle ligaer</option>
                  {leagues.map((lg) => (
                    <option key={lg} value={lg}>{lg}</option>
                  ))}
                </select>
              </Field>
              <Field label={`Maks alder · ${ageMax}`}>
                <input type="range" min={16} max={40} value={ageMax} onChange={(e) => setAgeMax(+e.target.value)} className="w-32 accent-volt" />
              </Field>
              <Field label={`Min. minutter · ${minMin}`}>
                <input type="range" min={0} max={3000} step={90} value={minMin} onChange={(e) => setMinMin(+e.target.value)} className="w-32 accent-volt" />
              </Field>
              <Field label="Sortér efter">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className={FILT}>
                  <option value="auto">Auto</option>
                  <option value="out">OUT-score</option>
                  <option value="match">Match-score</option>
                  {template && <option value="sim">Lighed</option>}
                </select>
              </Field>
            </div>

            {/* stat requirements */}
            <div className="border-t border-line/60 pt-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-volt">Stat-krav (percentil)</span>
                <button onClick={addReq} className="rounded border border-line-2 px-1.5 py-0.5 font-mono text-[10px] text-muted transition-colors hover:text-volt">
                  + krav
                </button>
              </div>
              {reqs.length === 0 ? (
                <p className="font-mono text-[11px] text-faint">Ingen krav — rangeres på OUT. Tilføj fx “Vellykkede driblinger ≥ 70”.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {reqs.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-ink px-2 py-1">
                      <select
                        value={r.key}
                        onChange={(e) => setReqs((rr) => rr.map((x, j) => (j === i ? { ...x, key: e.target.value as MetricKey } : x)))}
                        className="bg-transparent font-mono text-[11px] text-fg outline-none"
                      >
                        {SHORTLIST_GROUPS.map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.keys.map((k) => (
                              <option key={k} value={k}>{METRIC_NAME[k]}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <span className="font-mono text-[11px] text-faint">≥</span>
                      <input
                        type="number" min={0} max={100} value={r.min}
                        onChange={(e) => setReqs((rr) => rr.map((x, j) => (j === i ? { ...x, min: Math.max(0, Math.min(100, +e.target.value)) } : x)))}
                        className="w-12 rounded border border-line-2 bg-panel/50 px-1 py-0.5 text-right font-mono text-[11px] text-fg outline-none"
                      />
                      <button onClick={() => setReqs((rr) => rr.filter((_, j) => j !== i))} className="pl-0.5 font-mono text-[11px] text-faint hover:text-clay">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* template similarity */}
            <div className="relative border-t border-line/60 pt-3">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-volt">Ligner som (valgfri)</span>
              {template ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-volt/40 bg-volt/10 px-2.5 py-1">
                  <span className="text-sm text-fg">{template.n}</span>
                  <span className="font-mono text-[10px] text-faint">{template.t} · {LG(template.lg)}</span>
                  <button onClick={() => { setTplKey(null); setTplQuery(""); }} className="font-mono text-[11px] text-faint hover:text-clay">×</button>
                </div>
              ) : (
                <>
                  <input
                    value={tplQuery}
                    onChange={(e) => setTplQuery(e.target.value)}
                    placeholder="Søg en template-spiller…"
                    className="w-64 rounded-lg border border-line-2 bg-ink px-3 py-1.5 text-sm text-fg outline-none placeholder:text-faint focus:border-volt/50"
                  />
                  {tplHits.length > 0 && (
                    <div className="absolute z-[70] mt-1 w-64 overflow-hidden rounded-lg border border-line-2 bg-panel/98 shadow-xl">
                      {tplHits.map((h) => (
                        <button
                          key={h.key}
                          onClick={() => { setTplKey(h.key); setTplQuery(""); }}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-ink/50"
                        >
                          <span className="min-w-0 flex-1 truncate text-fg">{h.n}</span>
                          <span className="shrink-0 font-mono text-[10px] text-faint">{h.t} · {LG(h.lg)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* results */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted">
              <span className="tnum text-base font-bold text-fg">{results.length}</span> spillere matcher
              {results.length > 100 && <span className="text-faint"> · viser top 100</span>}
            </span>
            <span className="font-mono text-[10px] text-faint">sorteret: {effectiveSort === "sim" ? "lighed" : effectiveSort === "match" ? "match-score" : "OUT"}</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-ink-2">
                <tr className="border-b border-line">
                  <Th />
                  <Th>#</Th>
                  <Th left>Spiller</Th>
                  <Th left>Klub</Th>
                  <Th>Liga</Th>
                  <Th>Alder</Th>
                  <Th>Kampe</Th>
                  {reqs.map((r) => (
                    <Th key={r.key} title={METRIC_NAME[r.key]}>{METRIC_NAME[r.key].length > 12 ? METRIC_NAME[r.key].slice(0, 11) + "…" : METRIC_NAME[r.key]}</Th>
                  ))}
                  <Th>OUT</Th>
                  {template && <Th>Lighed</Th>}
                </tr>
              </thead>
              <tbody>
                {shown.map(({ p, sim }, i) => {
                  const perMatch = p.mp > 0 ? Math.round(p.min / p.mp) : null;
                  return (
                    <tr key={p.key} className="border-t border-line/50 transition-colors hover:bg-panel/50">
                      <td className="px-2 py-1.5 text-center">
                        <WatchlistButton target={{ sid: p.sid, key: p.key, n: p.n, t: p.t, lg: p.lg }} />
                      </td>
                      <td className="px-2 py-1.5 text-right tnum text-[11px] text-faint">{i + 1}</td>
                      <td className="whitespace-nowrap px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <Flag nat={p.nat} />
                          <button onClick={() => openPlayer(p.key)} className="font-medium text-fg transition-colors hover:text-volt">{p.n}</button>
                          {p.pos && <span className="font-mono text-[9px] text-faint">{p.pos}</span>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <Crest team={p.t} />
                          <span className="truncate text-muted">{p.t}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono text-[10px] text-faint">{LG(p.lg)}</td>
                      <td className="px-2 py-1.5 text-right tnum text-muted">{p.age ?? "—"}</td>
                      <td className="px-2 py-1.5 text-right leading-tight">
                        <div className="tnum text-muted">{p.mp}</div>
                        <div className="tnum font-mono text-[10px] text-faint">{perMatch != null ? `${perMatch}′` : "—"}</div>
                      </td>
                      {reqs.map((r) => (
                        <td key={r.key} className="px-2 py-1.5 text-right tnum text-fg" style={{ backgroundColor: cellBg(p.p[r.key] ?? null) }}>
                          {fmtVal(r.key, p.v[r.key] ?? null)}
                          <span className="ml-1 font-mono text-[9px] text-faint">{p.p[r.key] != null ? Math.round(p.p[r.key]!) : "—"}</span>
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right tnum font-semibold text-volt">{p.out ?? "—"}</td>
                      {template && (
                        <td className="px-2 py-1.5 text-right tnum font-semibold" style={{ color: sim != null ? "var(--color-volt)" : "var(--color-faint)" }}>
                          {sim != null ? `${sim}%` : "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr><td colSpan={9 + reqs.length} className="px-3 py-10 text-center font-mono text-sm text-faint">Ingen spillere matcher — løsn kravene.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function cellBg(pct: number | null): string | undefined {
  if (pct == null) return undefined;
  const a = (Math.abs(pct - 50) / 50) * 0.22;
  return pct >= 50 ? `rgba(77,124,90,${a})` : `rgba(180,105,74,${a})`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-faint">{label}</span>
      {children}
    </label>
  );
}

function Th({ children, left, title }: { children?: React.ReactNode; left?: boolean; title?: string }) {
  return (
    <th title={title} className={`px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-wider text-faint ${left ? "text-left" : "text-right"}`}>
      {children}
    </th>
  );
}

// ── Watchlists tab ──
function WatchTab({ byKey }: { byKey: Map<string, ShortlistPlayer> }) {
  const all = useWatchlists();
  const bySid = useMemo(() => {
    const m = new Map<number, ShortlistPlayer>();
    for (const p of byKey.values()) if (p.sid != null) m.set(p.sid, p);
    return m;
  }, [byKey]);
  const [newName, setNewName] = useState("");

  if (all.length === 0) {
    return (
      <div className="space-y-3 rounded-2xl border border-dashed border-line-2 bg-panel/20 p-8 text-center">
        <p className="font-mono text-sm text-muted">Ingen watchlists endnu.</p>
        <p className="font-mono text-[11px] text-faint">Tryk ☆ ud for en spiller i søgningen, eller opret en liste her.</p>
        <div className="mx-auto flex max-w-xs items-center gap-1.5">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newName.trim() && (watchlists.create(newName.trim()), setNewName(""))}
            placeholder="Navn på liste…" className="min-w-0 flex-1 rounded-lg border border-line-2 bg-ink px-3 py-1.5 text-sm text-fg outline-none placeholder:text-faint focus:border-volt/50" />
          <button onClick={() => { if (newName.trim()) { watchlists.create(newName.trim()); setNewName(""); } }} className="rounded-lg border border-line-2 px-3 py-1.5 font-mono text-xs text-muted hover:text-volt">Opret</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newName.trim() && (watchlists.create(newName.trim()), setNewName(""))}
          placeholder="Ny liste…" className="w-56 rounded-lg border border-line-2 bg-ink px-3 py-1.5 text-sm text-fg outline-none placeholder:text-faint focus:border-volt/50" />
        <button onClick={() => { if (newName.trim()) { watchlists.create(newName.trim()); setNewName(""); } }} className="rounded-lg border border-line-2 px-3 py-1.5 font-mono text-xs text-muted hover:text-volt">Opret liste</button>
      </div>

      {all.map((l) => (
        <div key={l.id} className="rounded-xl border border-line bg-panel/30">
          <div className="flex items-center justify-between border-b border-line/60 px-4 py-2.5">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-sm font-bold text-fg">{l.name}</span>
              <span className="font-mono text-[10px] text-faint">{l.players.length} spillere</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { const n = prompt("Omdøb liste", l.name); if (n && n.trim()) watchlists.rename(l.id, n.trim()); }}
                className="font-mono text-[10px] text-faint transition-colors hover:text-fg">omdøb</button>
              <button
                onClick={() => { if (confirm(`Slet "${l.name}"?`)) watchlists.remove(l.id); }}
                className="font-mono text-[10px] text-faint transition-colors hover:text-clay">slet</button>
            </div>
          </div>
          {l.players.length === 0 ? (
            <div className="px-4 py-5 text-center font-mono text-[11px] text-faint">tom — tilføj spillere fra søgningen (☆)</div>
          ) : (
            <ul className="divide-y divide-line/40">
              {l.players.map((e) => {
                const cur = (e.sid != null ? bySid.get(e.sid) : undefined) ?? byKey.get(e.key);
                return (
                  <li key={`${e.sid ?? e.key}`} className="flex items-center gap-2 px-4 py-2 transition-colors hover:bg-panel/50">
                    <Crest team={cur?.t ?? e.t} />
                    <button onClick={() => openPlayer(cur?.key ?? e.key)} className="min-w-0 flex-1 text-left">
                      <span className="text-fg transition-colors hover:text-volt">{cur?.n ?? e.n}</span>
                      <span className="ml-1.5 font-mono text-[10px] text-faint">{cur?.t ?? e.t} · {LG(cur?.lg ?? e.lg)}{cur?.age != null && ` · ${cur.age}`}</span>
                    </button>
                    {cur?.out != null && <span className="tnum shrink-0 font-mono text-xs font-semibold text-volt">{cur.out}</span>}
                    <button onClick={() => watchlists.removePlayer(l.id, e.sid, e.key)} className="shrink-0 px-1 font-mono text-[11px] text-faint transition-colors hover:text-clay" title="Fjern">×</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function Crest({ team }: { team: string }) {
  const [ok, setOk] = useState(true);
  const url = teamLogoUrl(team);
  if (!url || !ok) return <span className="inline-block h-4 w-4 shrink-0" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" onError={() => setOk(false)} loading="lazy" className="h-4 w-4 shrink-0 object-contain" />;
}

function Flag({ nat }: { nat: string | null }) {
  const [ok, setOk] = useState(true);
  if (!nat) return <span className="inline-block h-2.5 w-3.5 shrink-0" aria-hidden />;
  const url = flagUrl(nat);
  if (!url || !ok) return <span className="shrink-0 font-mono text-[9px] text-faint">{nat}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={nat} title={nat} onError={() => setOk(false)} className="inline-block h-2.5 w-auto shrink-0 rounded-[1px]" />;
}
