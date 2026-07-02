"use client";

import { useMemo, useState } from "react";
import { ScatterDashboard, type PlayerPoint, type TeamPoint } from "./scatter-dashboard";
import { TopLists, type DashPlayer } from "./top-lists";
import { TeamLists, type DashTeam } from "./team-lists";
import { IconSelect, type Opt } from "./icon-select";
import { leagueLabel } from "@/lib/league-meta";
import { flagUrl, leagueFlagUrl } from "@/lib/flags";

function FlagImg({ url }: { url: string | null }) {
  if (!url) return <span className="inline-block h-2.5 w-3.5 shrink-0" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="inline-block h-2.5 w-auto shrink-0 rounded-[1px]" />;
}

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
  const [nat, setNat] = useState("ALL");

  const leagues = useMemo(() => {
    const src = isPlayers ? playerPoints.map((p) => p.lg) : teamPoints.map((t) => t.lg);
    return [...new Set(src)].sort();
  }, [isPlayers, playerPoints, teamPoints]);

  const nations = useMemo(
    () => [...new Set(playerPoints.map((p) => p.nat).filter((n): n is string => !!n))].sort(),
    [playerPoints],
  );

  const keepLg = <T extends { lg: string }>(rows: T[]) =>
    league === "ALL" ? rows : rows.filter((r) => r.lg === league);
  const keepNat = <T extends { nat: string | null }>(rows: T[]) =>
    nat === "ALL" ? rows : rows.filter((r) => r.nat === nat);

  const fPlayerPoints = useMemo(() => keepNat(keepLg(playerPoints)), [playerPoints, league, nat]);
  const fTeamPoints = useMemo(() => keepLg(teamPoints), [teamPoints, league]);
  const fDashPlayers = useMemo(() => keepNat(keepLg(dashPlayers)), [dashPlayers, league, nat]);
  const fDashTeams = useMemo(() => keepLg(dashTeams), [dashTeams, league]);

  const leagueOpts: Opt[] = [
    { value: "ALL", label: "Alle ligaer", icon: <span className="inline-block h-2.5 w-3.5" /> },
    ...leagues.map((lg) => ({ value: lg, label: leagueLabel(lg), icon: <FlagImg url={leagueFlagUrl(lg)} /> })),
  ];
  const natOpts: Opt[] = [
    { value: "ALL", label: "Alle nationer", icon: <span className="inline-block h-2.5 w-3.5" /> },
    ...nations.map((n) => ({ value: n, label: n, icon: <FlagImg url={flagUrl(n)} /> })),
  ];

  const scope =
    (league === "ALL" ? "alle ligaer" : leagueLabel(league)) + (nat !== "ALL" ? ` · ${nat}` : "");

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <IconSelect label="Liga" value={league} onChange={setLeague} options={leagueOpts} minWidth={160} />
        {isPlayers && (
          <IconSelect label="Nationalitet" value={nat} onChange={setNat} options={natOpts} minWidth={160} />
        )}
        <span className="mb-1.5 font-mono text-[10px] text-faint">
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
