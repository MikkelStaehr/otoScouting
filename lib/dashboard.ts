// Builds the compact dashboard payloads (scatter points + leaderboard rows) once
// per data version and caches them, so the landing page is a cached read instead
// of mapping ~6000 players + 260 teams on every request.

import { statSync } from "node:fs";
import { join } from "node:path";
import { getCrossLeaguePlayers } from "./players.ts";
import { getAllTeams } from "./teams.ts";
import { PLAYER_AXES, TEAM_AXES } from "./scatter-axes.ts";
import type { PlayerPoint, TeamPoint } from "../components/scatter-dashboard.tsx";
import type { DashPlayer } from "../components/top-lists.tsx";
import type { DashTeam } from "../components/team-lists.tsx";

export const LIST_MIN = 540; // leaderboard qualification (minutes ~ 6 games)
const DASH_METRICS = [
  "npg", "key_passes", "big_chances_created", "dribbles",
  "ball_recovery", "tackles", "aerial_won", "pass_pct",
];
const TEAM_DASH_METRICS = [
  "goals", "xg", "big_chances", "possession", "pass_pct",
  "goals_conceded", "shots_against", "clean_sheets",
];

export interface DashboardData {
  playerPoints: PlayerPoint[];
  teamPoints: TeamPoint[];
  dashPlayers: DashPlayer[];
  dashTeams: DashTeam[];
  leagueCount: number;
}

function dataVersion(): string {
  return ["scouting.db", "config/model.json", "config/leagues.json"]
    .map((f) => {
      try {
        return statSync(join(process.cwd(), f)).mtimeMs;
      } catch {
        return 0;
      }
    })
    .join("-");
}

let cache: { version: string; data: DashboardData } | null = null;

export function getDashboardData(): DashboardData {
  const version = dataVersion();
  if (cache && cache.version === version) return cache.data;

  const { players } = getCrossLeaguePlayers();
  const teams = getAllTeams();

  const playerPoints: PlayerPoint[] = players
    .filter((p) => (p.minutes ?? 0) >= 450)
    .map((p) => {
      const per90 = p.per90 as unknown as Record<string, number | null>;
      return {
        n: p.player, t: p.team, lg: p.league, age: p.age ?? null, min: p.minutes,
        out: p.outputScore == null ? null : Math.round(p.outputScore),
        v: Object.fromEntries(PLAYER_AXES.map((a) => [a.key, per90[a.key] ?? null])),
      };
    });

  const teamPoints: TeamPoint[] = teams.map((t) => {
    const value = t.value as unknown as Record<string, number | null>;
    return {
      n: t.team, lg: t.league,
      v: Object.fromEntries(TEAM_AXES.map((a) => [a.key, value[a.key] ?? null])),
    };
  });

  const dashPlayers: DashPlayer[] = players
    .filter((p) => (p.minutes ?? 0) >= LIST_MIN)
    .map((p) => {
      const per90 = p.per90 as unknown as Record<string, number | null>;
      return {
        n: p.player, t: p.team, lg: p.league, age: p.age ?? null, min: p.minutes,
        out: p.outputScore == null ? null : Math.round(p.outputScore),
        xg: p.xg, goals: p.goals, gp: p.gk_goals_prevented, isGk: p.gk_saves != null,
        m: Object.fromEntries(DASH_METRICS.map((k) => [k, per90[k] ?? null])),
      };
    });

  const dashTeams: DashTeam[] = teams.map((t) => {
    const value = t.value as unknown as Record<string, number | null>;
    return {
      n: t.team, lg: t.league, matches: t.matches, rating: t.avg_rating ?? null,
      m: Object.fromEntries(TEAM_DASH_METRICS.map((k) => [k, value[k] ?? null])),
    };
  });

  const data: DashboardData = {
    playerPoints,
    teamPoints,
    dashPlayers,
    dashTeams,
    leagueCount: new Set(teams.map((t) => t.league)).size,
  };
  cache = { version, data };
  return data;
}
