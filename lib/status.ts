// Data-status for the Settings panel: per-league loaded counts (players from
// FBref, teams + xG from Sofascore), so you can watch an ingest fill the DB.

import { getDb } from "./db.ts";
import { loadLeagues, loadLeagueStrength } from "./league-config.ts";

export interface LeagueStatus {
  league: string;
  players: number; // FBref rows (the player spine)
  teams: number; // Sofascore teams
  xg: number; // Sofascore players carrying an xG value
  strength: number | null;
}

export interface StatusResponse {
  leagues: LeagueStatus[];
  totals: {
    players: number;
    teams: number;
    leaguesWithPlayers: number;
    leaguesWithTeams: number;
    leaguesTotal: number;
  };
}

function countBy(sql: string): Map<string, number> {
  try {
    const rows = getDb().prepare(sql).all() as { league: string; c: number }[];
    return new Map(rows.map((r) => [r.league, r.c]));
  } catch {
    return new Map();
  }
}

export function getLeagueStatus(): StatusResponse {
  const keys = Object.keys(loadLeagues());
  const strength = loadLeagueStrength();

  const players = countBy("SELECT league, COUNT(*) c FROM players GROUP BY league");
  const teams = countBy(
    "SELECT league, COUNT(DISTINCT team) c FROM sofascore_teams GROUP BY league",
  );
  const xg = countBy(
    "SELECT league, COUNT(*) c FROM sofascore_players WHERE xg IS NOT NULL GROUP BY league",
  );

  const leagues: LeagueStatus[] = keys.map((league) => ({
    league,
    players: players.get(league) ?? 0,
    teams: teams.get(league) ?? 0,
    xg: xg.get(league) ?? 0,
    strength: strength[league] ?? null,
  }));

  return {
    leagues,
    totals: {
      players: leagues.reduce((s, l) => s + l.players, 0),
      teams: leagues.reduce((s, l) => s + l.teams, 0),
      leaguesWithPlayers: leagues.filter((l) => l.players > 0).length,
      leaguesWithTeams: leagues.filter((l) => l.teams > 0).length,
      leaguesTotal: keys.length,
    },
  };
}
