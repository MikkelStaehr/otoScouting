"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlayerTable } from "./player-table";
import { TeamTable } from "./team-table";
import type { LeagueSeasonOption } from "@/lib/teams";
import type {
  EnrichedPlayer,
  EnrichedTeam,
  GroupKey,
  MetricKey,
} from "@/lib/types";

const LEAGUE_LABEL: Record<string, string> = {
  "DEN-Superliga": "Superliga",
  "NOR-Eliteserien": "Eliteserien",
  "SWE-Allsvenskan": "Allsvenskan",
  "NED-Eredivisie": "Eredivisie",
  "POR-PrimeiraLiga": "Primeira Liga",
  "ENG-Championship": "Championship",
  "GER-2Bundesliga": "2. Bundesliga",
  "BEL-ProLeague": "Pro League",
  "AUT-Bundesliga": "Bundesliga (AUT)",
  "SUI-SuperLeague": "Super League",
  "SCO-Premiership": "Premiership",
  "POL-Ekstraklasa": "Ekstraklasa",
  "CRO-HNL": "HNL",
  "CZE-FirstLeague": "1. liga (CZE)",
  "FIN-Veikkausliiga": "Veikkausliiga",
  "ISL-Bestadeild": "Besta deild",
};
const leagueLabel = (k: string) => LEAGUE_LABEL[k] ?? k;

export function BoardSwitch({
  players,
  teams,
  teamOptions,
  selectedTeam,
  crossLeague = false,
  groups,
  rates,
  comparedTo,
}: {
  players: EnrichedPlayer[];
  teams: EnrichedTeam[];
  teamOptions: LeagueSeasonOption[];
  selectedTeam: LeagueSeasonOption | null;
  crossLeague?: boolean;
  groups: Record<GroupKey, MetricKey[]>;
  rates: MetricKey[];
  comparedTo: string | null;
}) {
  // Cross-league is a players-only view (team ranks are per-league), so open on
  // Spillere when it's active; otherwise keep the Hold-first default.
  const [scope, setScope] = useState<"players" | "teams">(
    crossLeague ? "players" : "teams",
  );
  const router = useRouter();

  // Navigating into "Alle ligaer" reuses this component (no remount), so the
  // initial state above doesn't re-run — force Spillere, since Hold is per-league.
  useEffect(() => {
    if (crossLeague) setScope("players");
  }, [crossLeague]);

  const leagues = [...new Set(teamOptions.map((o) => o.league))];
  const seasonsForSelected = teamOptions.filter(
    (o) => o.league === selectedTeam?.league,
  );

  function pick(league: string, season: string) {
    router.push(`/board?league=${encodeURIComponent(league)}&season=${season}`, {
      scroll: false,
    });
  }

  // One selector drives both boards, so the header is just the selected
  // league/season; only the count + unit change with the active tab.
  const isTeams = scope === "teams";
  const headLeague = crossLeague
    ? "Alle ligaer"
    : (selectedTeam?.league ?? "").replace("-", " · ");
  const headLabel = selectedTeam?.season_label ?? "";
  const headCount = isTeams ? teams.length : players.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-volt">
            {headLeague}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {headLabel}
            <span className="ml-3 align-middle font-mono text-sm font-normal text-muted">
              scouting board
            </span>
          </h1>
        </div>
        <div className="text-right">
          <div className="tnum text-3xl font-bold text-volt">{headCount}</div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted">
            {isTeams ? "hold" : "spillere"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex overflow-hidden rounded-lg border border-line-2">
          {(["teams", "players"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-6 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                scope === s ? "bg-volt text-ink" : "bg-panel/40 text-muted hover:text-fg"
              }`}
            >
              {s === "players" ? "Spillere" : "Hold"}
            </button>
          ))}
        </div>

        {/* League + season selector drives both boards. */}
        {leagues.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-lg border border-line-2 bg-ink px-2.5 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Liga</span>
              <select
                value={crossLeague ? "ALL" : selectedTeam?.league ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "ALL") pick("ALL", "");
                  else pick(v, teamOptions.find((o) => o.league === v)?.season ?? "");
                }}
                className="bg-transparent py-0.5 pr-1 text-sm text-fg outline-none"
              >
                {leagues.map((lg) => (
                  <option key={lg} value={lg}>
                    {leagueLabel(lg)}
                  </option>
                ))}
                <option value="ALL">⚑ Alle ligaer</option>
              </select>
            </label>
            {seasonsForSelected.length > 1 && (
              <span className="flex items-center gap-1">
                {seasonsForSelected.map((o) => (
                  <button
                    key={o.season}
                    onClick={() => pick(o.league, o.season)}
                    className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors ${
                      selectedTeam?.season === o.season
                        ? "border-volt/50 bg-volt/15 text-volt"
                        : "border-line-2 text-faint hover:text-muted"
                    }`}
                  >
                    {o.season_label}
                  </button>
                ))}
              </span>
            )}
          </div>
        )}

      </div>

      {scope === "players" ? (
        <PlayerTable
          players={players}
          groups={groups}
          rates={rates}
          comparedTo={comparedTo}
          crossLeague={crossLeague}
        />
      ) : crossLeague ? (
        <div className="rounded-xl border border-dashed border-line-2 bg-panel/30 px-5 py-10 text-center font-mono text-sm text-muted">
          Hold-rangeringen er per liga (percentiler inden for hver liga).
          <br />
          Vælg en enkelt liga ovenfor for holdvisningen.
        </div>
      ) : (
        <TeamTable teams={teams} />
      )}
    </div>
  );
}
