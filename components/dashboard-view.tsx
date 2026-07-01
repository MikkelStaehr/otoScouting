"use client";

import { ScatterDashboard, type PlayerPoint, type TeamPoint } from "./scatter-dashboard";
import { TopLists, type DashPlayer } from "./top-lists";
import { TeamLists, type DashTeam } from "./team-lists";

// The dashboard body for one mode (players / teams). Mode is driven by the route
// (/ = Spillere, /hold = Hold) via the navbar, so there's no in-page toggle.
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

  return (
    <>
      <ScatterDashboard players={playerPoints} teams={teamPoints} mode={mode} />

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline gap-3 border-b border-line pb-2">
          <h2 className="font-display text-lg font-bold text-fg">Top-lister</h2>
          <span className="font-mono text-[11px] text-faint">
            {isPlayers ? `på tværs af alle ligaer · min. ${listMin} min.` : "per kamp · alle ligaer"}
            {" "}· klik en kasse for hele listen
          </span>
        </div>
        {isPlayers ? <TopLists players={dashPlayers} /> : <TeamLists teams={dashTeams} />}
      </div>
    </>
  );
}
