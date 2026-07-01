// Team-performance read layer. Loads Sofascore team season stats, derives team
// xG/xA by summing player xG (player & team names share the Sofascore spelling,
// so an exact-name aggregation works), normalises counts per match, and ranks
// each metric within the 12-team league.

import { statSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./db.ts";
import { TEAM_METRICS, type TeamMetricDef } from "./team-metrics.ts";
import type { EnrichedTeam, RawTeam, TeamMetricKey } from "./types.ts";

function percentileOf(sortedAsc: number[], v: number): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedAsc[mid]! <= v) lo = mid + 1;
    else hi = mid;
  }
  return (lo / n) * 100;
}

export interface LeagueSeasonOption {
  league: string;
  season: string;
  season_label: string;
}

/** Distinct (league, season) with team data — for the selector. */
export function getTeamLeagueSeasons(): LeagueSeasonOption[] {
  try {
    const rows = getDb()
      .prepare(
        `SELECT DISTINCT league, season, season_label FROM sofascore_teams
          ORDER BY league, season DESC`,
      )
      .all() as unknown as LeagueSeasonOption[];
    // node:sqlite rows have a null prototype — make plain objects for the client.
    return rows.map((r) => ({
      league: r.league,
      season: r.season,
      season_label: r.season_label,
    }));
  } catch {
    return [];
  }
}

function rawTeams(league: string, season: string): RawTeam[] {
  try {
    return getDb()
      .prepare(`SELECT * FROM sofascore_teams WHERE league = ? AND season = ?`)
      .all(league, season) as unknown as RawTeam[];
  } catch {
    return [];
  }
}

/** Derived team xG/xA for, summed from player xG/xA (exact team-name match). */
function teamXg(league: string, season: string): Map<string, { xg: number; xa: number }> {
  try {
    const rows = getDb()
      .prepare(
        `SELECT team, COALESCE(SUM(xg),0) AS xg, COALESCE(SUM(xa),0) AS xa
           FROM sofascore_players WHERE league = ? AND season = ? GROUP BY team`,
      )
      .all(league, season) as unknown as { team: string; xg: number; xa: number }[];
    return new Map(rows.map((r) => [r.team, { xg: r.xg, xa: r.xa }]));
  } catch {
    return new Map();
  }
}

export function getTeams(league: string, season: string): EnrichedTeam[] {
  const all = rawTeams(league, season);
  if (!all.length) return [];
  // Drop non-participants: some Sofascore tournaments include a handful of
  // playoff/relegation entries (e.g. Scottish Championship clubs under the
  // Premiership id) with 2-4 matches and empty stats. Keep only teams with at
  // least half the league's match count so percentiles + leaderboards are clean.
  const maxMatches = Math.max(...all.map((t) => t.matches ?? 0), 1);
  const teams = all.filter((t) => (t.matches ?? 0) >= maxMatches * 0.5);
  const xgMap = teamXg(league, season);

  // Display value for a team on a metric: rate as-is, else per-match.
  const valueOf = (t: RawTeam, m: TeamMetricDef, xg: number): number | null => {
    if (m.key === "xg") return t.matches ? xg / t.matches : null;
    const raw = (t as unknown as Record<string, number | null>)[m.key];
    if (raw === null || raw === undefined) return null;
    return m.rate ? raw : t.matches ? raw / t.matches : null;
  };

  const enriched = teams.map((t) => {
    const d = xgMap.get(t.team) ?? { xg: 0, xa: 0 };
    const value = {} as Record<TeamMetricKey, number | null>;
    for (const m of TEAM_METRICS) value[m.key] = valueOf(t, m, d.xg);
    return { ...t, xg: d.xg, xa: d.xa, value, percentile: {} as Record<TeamMetricKey, number | null> };
  });

  // Percentile each metric within the 12 teams (invert → lower is better).
  for (const m of TEAM_METRICS) {
    const sorted = enriched
      .map((t) => t.value[m.key])
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    for (const t of enriched) {
      const v = t.value[m.key];
      if (v == null) t.percentile[m.key] = null;
      else {
        const pct = percentileOf(sorted, v);
        t.percentile[m.key] = m.invert ? 100 - pct : pct;
      }
    }
  }

  return enriched.sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0));
}

let allTeamsCache: { version: string; teams: EnrichedTeam[] } | null = null;

/** Every league's teams in one flat list (per-match values), for the dashboard
 *  scatter/leaderboards. Cached until the DB changes so it's off the request path. */
export function getAllTeams(): EnrichedTeam[] {
  let version = "0";
  try {
    version = String(statSync(join(process.cwd(), "scouting.db")).mtimeMs);
  } catch {
    /* keep default */
  }
  if (allTeamsCache && allTeamsCache.version === version) return allTeamsCache.teams;
  const out: EnrichedTeam[] = [];
  for (const ls of getTeamLeagueSeasons()) out.push(...getTeams(ls.league, ls.season));
  allTeamsCache = { version, teams: out };
  return out;
}
