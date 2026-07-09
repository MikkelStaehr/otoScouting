"use client";

import { useEffect, useMemo, useState } from "react";
import type { EnrichedTeam, TeamMetricKey } from "@/lib/types";
import { TEAM_METRICS, type TeamMetricDef } from "@/lib/team-metrics";
import { teamLogoUrl } from "@/lib/team-logos";
import { medianStyle } from "@/lib/heat";
import { openTeam } from "./team-modal";

const OFF = TEAM_METRICS.filter((m) => m.group === "off");
const DEF = TEAM_METRICS.filter((m) => m.group === "def");

function fmt(m: TeamMetricDef, v: number | null): string {
  if (v == null) return "—";
  if (m.rate) return v.toFixed(1);
  return v < 3 ? v.toFixed(2) : v.toFixed(1);
}

export function TeamTable({ teams, crossLeague = false }: { teams: EnrichedTeam[]; crossLeague?: boolean }) {
  const [sortKey, setSortKey] = useState<string>(crossLeague ? "score" : "avg_rating");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // avg_rating isn't cross-league comparable, so default to the strength-adjusted
  // Score when the pool is cross-league (and back to rating for a single league).
  useEffect(() => {
    setSortKey(crossLeague ? "score" : "avg_rating");
    setSortDir("desc");
  }, [crossLeague]);

  function sortValue(t: EnrichedTeam, key: string): number | string {
    if (key === "team") return t.team;
    if (key === "matches") return t.matches;
    if (key === "score") return t.score ?? -Infinity;
    if (key === "avg_rating") return t.avg_rating ?? -Infinity;
    return t.value[key as TeamMetricKey] ?? -Infinity;
  }
  const sorted = useMemo(() => {
    const arr = [...teams];
    arr.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp =
        typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [teams, sortKey, sortDir]);

  function toggleSort(key: string, isText = false) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(isText ? "asc" : "desc");
    }
  }

  if (!teams.length)
    return (
      <p className="py-8 text-center font-mono text-sm text-muted">
        Ingen hold-data endnu — kør et data-refresh (⚙).
      </p>
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-muted">
          <span className="tnum text-base font-bold text-fg">{teams.length}</span> hold
        </span>
        <span
          className="flex items-center gap-1.5 font-mono text-[10px] text-faint"
          title="Cellefarve = over/under medianen blandt ligaens hold"
        >
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "rgba(77,124,90,0.75)" }} />
          over
          <span className="ml-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "rgba(180,105,74,0.75)" }} />
          under median
        </span>
        <span className="font-mono text-[10px] text-faint">tællestats er per kamp</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-ink-2">
            <tr>
              <th colSpan={crossLeague ? 4 : 3} className="bg-ink-2 px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                Hold
              </th>
              <th colSpan={OFF.length} className="border-l-2 border-volt/30 px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-volt">
                Offensive nøgletal
              </th>
              <th colSpan={DEF.length} className="border-l-2 border-volt/30 px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-volt">
                Defensive nøgletal
              </th>
            </tr>
            <tr className="border-b border-line">
              <Th sticky onClick={() => toggleSort("team", true)} active={sortKey === "team"} dir={sortDir}>Hold</Th>
              <Th num onClick={() => toggleSort("matches")} active={sortKey === "matches"} dir={sortDir}>Kampe</Th>
              {crossLeague && (
                <Th num accent onClick={() => toggleSort("score")} active={sortKey === "score"} dir={sortDir}>Score</Th>
              )}
              <Th num accent onClick={() => toggleSort("avg_rating")} active={sortKey === "avg_rating"} dir={sortDir}>Rating</Th>
              {OFF.map((m, i) => (
                <Th key={m.key} num divider={i === 0} onClick={() => toggleSort(m.key)} active={sortKey === m.key} dir={sortDir}>
                  {m.label}
                </Th>
              ))}
              {DEF.map((m, i) => (
                <Th key={m.key} num divider={i === 0} onClick={() => toggleSort(m.key)} active={sortKey === m.key} dir={sortDir}>
                  {m.label}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr key={t.sofascore_team_id} className="border-t border-line/60 transition-colors hover:bg-panel/50">
                <td className="sticky left-0 z-[1] whitespace-nowrap bg-ink px-3 py-2 font-medium text-fg">
                  <span className="mr-2 tnum text-[11px] text-faint">{i + 1}</span>
                  <TeamLogo team={t.team} />
                  <button
                    onClick={() => openTeam(t.league, t.team)}
                    title="Se forsvars-svagheder + fit-forslag"
                    className="text-left transition-colors hover:text-volt"
                  >
                    {t.team}
                  </button>
                  {crossLeague && (
                    <span className="ml-2 rounded bg-ink-2 px-1 py-0.5 font-mono text-[9px] text-faint">
                      {t.league.split("-")[0]}
                    </span>
                  )}
                  <a
                    href={`/team-report/${encodeURIComponent(`${t.league}::${t.team}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Åbn hold-rapport (print/PDF)"
                    className="ml-1.5 font-mono text-[11px] text-faint transition-colors hover:text-volt"
                  >
                    ↗
                  </a>
                </td>
                <td className="px-3 py-2 text-right tnum text-muted">{t.matches}</td>
                {crossLeague && (
                  <td className="px-3 py-2 text-right tnum font-bold text-volt">
                    {t.score != null ? Math.round(t.score) : "—"}
                  </td>
                )}
                <td className="px-3 py-2 text-right tnum font-semibold text-volt">{t.avg_rating?.toFixed(2) ?? "—"}</td>
                {OFF.map((m, j) => (
                  <td key={m.key} className={`px-3 py-2 text-right tnum text-fg ${j === 0 ? "border-l-2 border-line-2" : ""}`} style={medianStyle(t.percentile[m.key])}>
                    {fmt(m, t.value[m.key])}
                  </td>
                ))}
                {DEF.map((m, j) => (
                  <td key={m.key} className={`px-3 py-2 text-right tnum text-fg ${j === 0 ? "border-l-2 border-line-2" : ""}`} style={medianStyle(t.percentile[m.key])}>
                    {fmt(m, t.value[m.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamLogo({ team }: { team: string }) {
  const [ok, setOk] = useState(true);
  const url = teamLogoUrl(team);
  if (!url || !ok) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" onError={() => setOk(false)} loading="lazy" className="mr-2 inline-block h-4 w-4 object-contain align-middle" />
  );
}

function Th({
  children,
  num,
  accent,
  sticky,
  active,
  dir,
  onClick,
  divider,
}: {
  children: React.ReactNode;
  num?: boolean;
  accent?: boolean;
  sticky?: boolean;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
  divider?: boolean;
}) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none px-3 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wider hover:text-fg ${
        num ? "text-right" : "text-left"
      } ${accent ? "text-volt" : active ? "text-fg" : "text-muted"} ${
        sticky ? "sticky left-0 z-[1] bg-ink-2" : ""
      } ${divider ? "border-l-2 border-line-2" : ""}`}
    >
      {children}
      {active && <span className="ml-1 text-volt">{dir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );
}
