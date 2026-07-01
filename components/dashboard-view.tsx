"use client";

import { useState } from "react";
import { ScatterDashboard, type PlayerPoint, type TeamPoint } from "./scatter-dashboard";
import { TopLists, type DashPlayer } from "./top-lists";
import { TeamLists, type DashTeam } from "./team-lists";

// Owns the Spillere/Hold mode so the scatter toggle and the leaderboards below
// stay in sync — one switch drives the whole dashboard.
export function DashboardView({
  playerPoints,
  teamPoints,
  dashPlayers,
  dashTeams,
  listMin,
}: {
  playerPoints: PlayerPoint[];
  teamPoints: TeamPoint[];
  dashPlayers: DashPlayer[];
  dashTeams: DashTeam[];
  listMin: number;
}) {
  const [mode, setMode] = useState<"players" | "teams">("players");
  const isPlayers = mode === "players";

  return (
    <>
      <ScatterDashboard players={playerPoints} teams={teamPoints} mode={mode} setMode={setMode} />

      <p className="mt-4 font-mono text-xs text-faint">
        Sæt X og Y og se hvem der afviger fra mængden. Grøn stiplet = y=x
        (over/under-performance, fx mål vs xG). De mest markante navngives
        automatisk; søg for at fremhæve. Kun de små/producerende ligaer.
      </p>

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline gap-3 border-b border-line pb-2">
          <h2 className="font-display text-lg font-bold text-fg">
            Top-lister · {isPlayers ? "spillere" : "hold"}
          </h2>
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
