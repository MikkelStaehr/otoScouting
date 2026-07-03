// Transfermarkt market values, loaded for a league-season and matched onto our
// players. Shaped as { player, team, ... } so it reuses matchSofascore (the same
// name+team fuzzy matcher used for FBref↔Sofascore) — market value is the "value"
// side of value-per-output. Unmatched players simply get no value (shown as "—").

import { getDb } from "./db.ts";

export interface TmRow {
  player: string; // TM display name, aliased from `name` for the matcher
  team: string;
  market_value: number | null; // euros
  tm_id: number;
  position: string | null;
  age: number | null;
  nationality: string | null;
}

/** Transfermarkt rows for a league-season, shaped for matchSofascore (name ->
 *  player). Mapped to plain objects (node:sqlite null-prototype). [] if the table
 *  hasn't been built yet. */
export function transfermarktRows(league: string, season: string): TmRow[] {
  try {
    return (
      getDb()
        .prepare(
          `SELECT name AS player, team, market_value, tm_id, position, age, nationality
             FROM transfermarkt_players WHERE league = ? AND season = ?`,
        )
        .all(league, season) as unknown as TmRow[]
    ).map((r) => ({ ...r }));
  } catch {
    return []; // transfermarkt_players table not present
  }
}
