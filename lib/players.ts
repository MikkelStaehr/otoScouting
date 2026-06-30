// App-facing queries. Returns small, browser-safe view models — the enriched
// player array for a league-season is computed server-side once per request.

import { getDb } from "./db.ts";
import { enrichPlayers, loadModelConfig } from "./model.ts";
import { matchSofascore } from "./merge.ts";
import type {
  EnrichedPlayer,
  LeagueSeason,
  MetricKey,
  PlayerIndexRow,
  RawPlayer,
} from "./types.ts";

interface SofaRow {
  player: string;
  team: string;
  player_id: number;
  xg: number | null;
  xa: number | null;
  goals_prevented: number | null;
}

/** Sofascore rows for a league-season; [] if the table hasn't been built yet. */
function sofascoreRows(league: string, season: string): SofaRow[] {
  try {
    return getDb()
      .prepare(
        `SELECT player, team, player_id, xg, xa, goals_prevented
           FROM sofascore_players WHERE league = ? AND season = ?`,
      )
      .all(league, season) as unknown as SofaRow[];
  } catch {
    return []; // sofascore_players table not present
  }
}

/** Previous Sofascore snapshot (for Δ vs last fetch), keyed by Sofascore id. */
function previousSofascore(league: string): {
  byId: Map<number, SofaRow>;
  createdAt: string | null;
} {
  try {
    const db = getDb();
    const snap = db
      .prepare(`SELECT MAX(snapshot_id) AS sid FROM sofascore_players_history`)
      .get() as { sid: number | null };
    if (!snap?.sid) return { byId: new Map(), createdAt: null };
    // history may predate the league column; filter only if present.
    const hasLeague = (
      db.prepare(`PRAGMA table_info(sofascore_players_history)`).all() as {
        name: string;
      }[]
    ).some((c) => c.name === "league");
    const rows = (
      hasLeague
        ? db.prepare(
            `SELECT player_id, xg, xa, goals_prevented FROM sofascore_players_history
               WHERE snapshot_id = ? AND league = ?`,
          ).all(snap.sid, league)
        : db.prepare(
            `SELECT player_id, xg, xa, goals_prevented FROM sofascore_players_history
               WHERE snapshot_id = ?`,
          ).all(snap.sid)
    ) as unknown as SofaRow[];
    const meta = db
      .prepare(`SELECT created_at FROM snapshots WHERE id = ?`)
      .get(snap.sid) as { created_at: string } | undefined;
    return {
      byId: new Map(rows.map((r) => [r.player_id, r])),
      createdAt: meta?.created_at ?? null,
    };
  } catch {
    return { byId: new Map(), createdAt: null };
  }
}

export interface Board {
  players: EnrichedPlayer[];
  /** How many players actually carry a non-null xG value (not just a name
   *  match). 0 means the source has no xG for this league (e.g. Allsvenskan). */
  xgMatched: number;
  xgTotal: number;
  /** Timestamp of the snapshot the Δ chips compare against, or null. */
  comparedTo: string | null;
}

/** All league-seasons present in the DB (for the header / future switching). */
export function getLeagueSeasons(): LeagueSeason[] {
  return getDb()
    .prepare(
      `SELECT league, season, season_label, COUNT(*) AS playerCount
         FROM players
        GROUP BY league, season
        ORDER BY season DESC, league`,
    )
    .all() as unknown as LeagueSeason[];
}

/** The default (newest) league-season, or null if the DB is empty. */
export function getDefaultLeagueSeason(): LeagueSeason | null {
  return getLeagueSeasons()[0] ?? null;
}

/** Timestamp of the most recent refresh (latest snapshot), or null. */
export function getLastUpdated(): string | null {
  try {
    const row = getDb()
      .prepare(`SELECT MAX(created_at) AS t FROM snapshots`)
      .get() as { t: string | null };
    return row?.t ?? null;
  } catch {
    return null; // snapshots table not created yet
  }
}

function rawPlayers(league: string, season: string): RawPlayer[] {
  return getDb()
    .prepare(`SELECT * FROM players WHERE league = ? AND season = ?`)
    .all(league, season) as unknown as RawPlayer[];
}

/** Enriched players for a league-season + Sofascore xG merged in, ranked by OUT. */
export function getEnrichedPlayers(league: string, season: string): Board {
  const rows = rawPlayers(league, season);

  // Merge Sofascore (xG/xA/goals prevented) onto FBref players by name+team.
  const { map, matched, total } = matchSofascore(rows, sofascoreRows(league, season));
  const prev = previousSofascore(league);
  const deltas = new Map<string, Partial<Record<MetricKey, number>>>();
  for (const p of rows) {
    const s = map.get(`${p.team}::${p.player}`);
    p.xg = s?.xg ?? null;
    p.xa = s?.xa ?? null;
    p.gk_goals_prevented = s?.goals_prevented ?? null;

    // Δ vs the previous Sofascore snapshot, matched by stable Sofascore id.
    const pv = s ? prev.byId.get(s.player_id) : undefined;
    if (s && pv) {
      const d: Partial<Record<MetricKey, number>> = {};
      if (s.xg != null && pv.xg != null) d.xg = s.xg - pv.xg;
      if (s.xa != null && pv.xa != null) d.xa = s.xa - pv.xa;
      if (s.goals_prevented != null && pv.goals_prevented != null)
        d.gk_goals_prevented = s.goals_prevented - pv.goals_prevented;
      deltas.set(`${p.team}::${p.player}`, d);
    }
  }

  const players = enrichPlayers(rows, loadModelConfig()).sort(
    (a, b) => (b.outputScore ?? -Infinity) - (a.outputScore ?? -Infinity),
  );
  for (const p of players) {
    const d = deltas.get(`${p.team}::${p.player}`);
    if (d) p.delta = d;
  }
  // Report players that actually have an xG value, not just a name match —
  // so a league the source omits xG for (Allsvenskan) honestly reads 0.
  void matched;
  const xgPresent = rows.filter((p) => p.xg != null).length;
  return {
    players,
    xgMatched: xgPresent,
    xgTotal: total,
    comparedTo: prev.createdAt,
  };
}

/** Small search index for the ⌘K palette. */
export function getPlayerIndex(league: string, season: string): PlayerIndexRow[] {
  return rawPlayers(league, season)
    .map((p) => ({
      key: `${p.team}::${p.player}`,
      player: p.player,
      team: p.team,
      pos: p.pos,
    }))
    .sort((a, b) => a.player.localeCompare(b.player));
}
