// A team's most-used formations over the season, from team_formations (filled by
// pipeline/fetch_formations.py — Sofascore match lineups). Empty until that runs.

import { getDb } from "./db.ts";

export interface Formation {
  formation: string;
  n: number; // matches in this formation
  pct: number; // share of the team's matches
}

/** Top formations for a team (by Sofascore team id), most-used first. */
export function getTeamFormations(league: string, season: string, teamId: number | null): Formation[] {
  if (teamId == null) return [];
  try {
    const rows = getDb()
      .prepare(
        `SELECT formation, n, matches FROM team_formations
          WHERE league = ? AND season = ? AND team_id = ?
          ORDER BY n DESC`,
      )
      .all(league, season, teamId) as { formation: string; n: number; matches: number }[];
    if (!rows.length) return [];
    const total = rows[0]!.matches || rows.reduce((s, r) => s + r.n, 0) || 1;
    return rows.map((r) => ({
      formation: r.formation,
      n: r.n,
      pct: Math.round((r.n / total) * 100),
    }));
  } catch {
    return []; // table not built yet
  }
}
