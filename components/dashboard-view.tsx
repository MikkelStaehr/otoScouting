"use client";

import { useMemo, useState } from "react";
import { ScatterDashboard, type PlayerPoint, type TeamPoint } from "./scatter-dashboard";
import { TopLists, type DashPlayer } from "./top-lists";
import { TeamLists, type DashTeam } from "./team-lists";

// The dashboard body for one mode (players / teams). Mode is driven by the route
// (/ = Spillere, /hold = Hold). A single page-level league filter scopes the whole
// page (scatter + top-lists) to one league; default is all leagues.
export function DashboardView({
  mode,
  playerPoints,
  teamPoints,
  dashPlayers,
  dashTeams,
  listMin,
}: {
  mode: "players" | "teams";
  playerPoints: PlayerPoint[];
  teamPoints: TeamPoint[];
  dashPlayers: DashPlayer[];
  dashTeams: DashTeam[];
  listMin: number;
}) {
  const isPlayers = mode === "players";
  const [league, setLeague] = useState("ALL");

  const leagues = useMemo(() => {
    const src = isPlayers ? playerPoints.map((p) => p.lg) : teamPoints.map((t) => t.lg);
    return [...new Set(src)].sort();
  }, [isPlayers, playerPoints, teamPoints]);

  const keep = <T extends { lg: string }>(rows: T[]) =>
    league === "ALL" ? rows : rows.filter((r) => r.lg === league);
  const fPlayerPoints = useMemo(() => keep(playerPoints), [playerPoints, league]);
  const fTeamPoints = useMemo(() => keep(teamPoints), [teamPoints, league]);
  const fDashPlayers = useMemo(() => keep(dashPlayers), [dashPlayers, league]);
  const fDashTeams = useMemo(() => keep(dashTeams), [dashTeams, league]);

  const scope = league === "ALL" ? "alle ligaer" : league.replace("-", " · ");

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Liga</span>
        <select
          value={league}
          onChange={(e) => setLeague(e.target.value)}
          className="rounded-lg border border-line-2 bg-ink px-3 py-1.5 font-mono text-xs text-fg outline-none focus:border-volt/50"
        >
          <option value="ALL">Alle ligaer</option>
          {leagues.map((lg) => (
            <option key={lg} value={lg}>{lg}</option>
          ))}
        </select>
        <span className="font-mono text-[10px] text-faint">
          scoper hele siden · {isPlayers ? fPlayerPoints.length : fTeamPoints.length} {isPlayers ? "spillere" : "hold"}
        </span>
      </div>

      <ScatterDashboard players={fPlayerPoints} teams={fTeamPoints} mode={mode} hideLeagueSelect />

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline gap-3 border-b border-line pb-2">
          <h2 className="font-display text-lg font-bold text-fg">Top-lister</h2>
          <span className="font-mono text-[11px] text-faint">
            {isPlayers ? `${scope} · min. ${listMin} min.` : `${scope} · per kamp`}
            {" "}· klik en kasse for hele listen
          </span>
        </div>
        {isPlayers ? <TopLists players={fDashPlayers} /> : <TeamLists teams={fDashTeams} />}
      </div>
    </>
  );
}
