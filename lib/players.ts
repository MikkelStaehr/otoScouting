// App-facing queries. Returns small, browser-safe view models — the enriched
// player array for a league-season is computed server-side once per request.

import { statSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./db.ts";
import { enrichPlayers, loadModelConfig } from "./model.ts";
import { loadLeagueStrength } from "./league-config.ts";
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
  // creation
  key_passes: number | null;
  big_chances_created: number | null;
  successful_dribbles: number | null;
  accurate_crosses: number | null;
  // defensive + build-up
  tackles: number | null;
  clearances: number | null;
  blocked_shots: number | null;
  ball_recovery: number | null;
  poss_won_att_third: number | null;
  aerial_duels_won: number | null;
  duels_won_pct: number | null;
  error_lead_to_shot: number | null;
  pass_accuracy_pct: number | null;
  total_passes: number | null;
  accurate_long_balls: number | null;
  long_ball_accuracy_pct: number | null;
  accurate_final_third_passes: number | null;
}

/** Sofascore rows for a league-season; [] if the table hasn't been built yet. */
function sofascoreRows(league: string, season: string): SofaRow[] {
  try {
    return getDb()
      .prepare(
        `SELECT player, team, player_id, xg, xa, goals_prevented,
                key_passes, big_chances_created, successful_dribbles, accurate_crosses,
                tackles, clearances, blocked_shots, ball_recovery,
                poss_won_att_third, aerial_duels_won, duels_won_pct,
                error_lead_to_shot, pass_accuracy_pct, total_passes,
                accurate_long_balls, long_ball_accuracy_pct,
                accurate_final_third_passes
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

// A mid-season transfer shows up as two FBref rows (one per club). FBref counting
// stats are split correctly across the stints, but Sofascore serves the WHOLE
// season on a single row (the current club) — matched onto both stints — so those
// must be taken once, not summed. Merge = sum FBref counts, take the Sofascore
// block once, keep identity from the most-minutes club.
const nmKey = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

const FB_SUM = [
  "mp", "starts", "minutes", "goals", "assists", "npg", "pk", "pkatt", "shots", "sot",
  "interceptions", "tackles_won", "crosses", "fouls", "fouled", "offsides", "yellows", "reds",
  "gk_saves", "gk_ga", "gk_sota", "gk_clean_sheets", "gk_pk_saved",
] as const;
const SOFA_TAKE = [
  "sofascore_id", "xg", "xa", "gk_goals_prevented", "key_passes", "big_chances_created",
  "dribbles", "acc_crosses", "tackles", "clearances", "blocks", "ball_recovery",
  "poss_won_att_third", "aerial_won", "duels_won_pct", "errors", "pass_pct", "passes",
  "long_balls", "long_ball_pct", "final_third_passes",
] as const;

function mergeGroup(g: RawPlayer[], sofaTeam: Map<RawPlayer, string | null>): RawPlayer {
  const byMin = [...g].sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0));
  // Current club = the stint whose team matches the Sofascore row's team (Sofascore
  // serves the season under the current club); else fall back to most minutes.
  const current = g.find((p) => {
    const st = sofaTeam.get(p);
    return st != null && nmKey(st) === nmKey(p.team);
  });
  const primary = current ?? byMin[0]!;
  const rec = (p: RawPlayer) => p as unknown as Record<string, number | null>;
  const merged = { ...primary } as unknown as Record<string, unknown>;

  for (const k of FB_SUM) {
    const vals = g.map((p) => rec(p)[k]);
    merged[k] = vals.every((v) => v == null) ? null : vals.reduce((s, v) => s! + (v ?? 0), 0);
  }
  // Recompute keeper save% from the summed shot totals.
  const saves = merged.gk_saves as number | null;
  const sota = merged.gk_sota as number | null;
  if (saves != null && sota != null && sota > 0) merged.gk_save_pct = (saves / sota) * 100;

  // Sofascore is already whole-season — take it from the stint that carries it.
  const src = byMin.find((p) => p.sofascore_id != null) ?? primary;
  for (const k of SOFA_TAKE) merged[k] = rec(src)[k] ?? null;

  merged.team = primary.team;
  // Current club first, then the others (most minutes first).
  merged.season_teams = [primary.team, ...byMin.filter((p) => p !== primary).map((p) => p.team)];
  return merged as unknown as RawPlayer;
}

/** Collapse same-player transfer stints within one league-season into one row. */
function mergeStints(rows: RawPlayer[], sofaTeam: Map<RawPlayer, string | null>): RawPlayer[] {
  const groups = new Map<string, RawPlayer[]>();
  for (const p of rows) {
    const k = nmKey(p.player);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(p);
  }
  const out: RawPlayer[] = [];
  for (const g of groups.values()) {
    if (g.length === 1) {
      out.push(g[0]!);
      continue;
    }
    // Two distinct non-null Sofascore ids → different people who share a name, not
    // a transfer; keep them separate.
    const ids = new Set(g.map((p) => p.sofascore_id).filter((x): x is number => x != null));
    if (ids.size > 1) out.push(...g);
    else out.push(mergeGroup(g, sofaTeam));
  }
  return out;
}

/** FBref rows for a league-season with Sofascore xG/xA/GP merged in, plus the
 *  Δ-vs-last-snapshot map. The shared prep for both single- and cross-league. */
function prepareRows(league: string, season: string): {
  rows: RawPlayer[];
  deltas: Map<string, Partial<Record<MetricKey, number>>>;
  comparedTo: string | null;
} {
  const rawRows = rawPlayers(league, season);

  // Merge Sofascore (xG/xA/goals prevented) onto FBref players by name+team.
  const { map } = matchSofascore(rawRows, sofascoreRows(league, season));
  const sofaTeam = new Map<RawPlayer, string | null>(); // current club (from Sofascore)
  for (const p of rawRows) {
    const s = map.get(`${p.team}::${p.player}`);
    sofaTeam.set(p, s?.team ?? null);
    p.sofascore_id = s?.player_id ?? null;
    p.xg = s?.xg ?? null;
    p.xa = s?.xa ?? null;
    p.gk_goals_prevented = s?.goals_prevented ?? null;
    // Sofascore creation
    p.key_passes = s?.key_passes ?? null;
    p.big_chances_created = s?.big_chances_created ?? null;
    p.dribbles = s?.successful_dribbles ?? null;
    p.acc_crosses = s?.accurate_crosses ?? null;
    // Sofascore defensive + build-up
    p.tackles = s?.tackles ?? null;
    p.clearances = s?.clearances ?? null;
    p.blocks = s?.blocked_shots ?? null;
    p.ball_recovery = s?.ball_recovery ?? null;
    p.poss_won_att_third = s?.poss_won_att_third ?? null;
    p.aerial_won = s?.aerial_duels_won ?? null;
    p.duels_won_pct = s?.duels_won_pct ?? null;
    p.errors = s?.error_lead_to_shot ?? null;
    p.pass_pct = s?.pass_accuracy_pct ?? null;
    p.passes = s?.total_passes ?? null;
    p.long_balls = s?.accurate_long_balls ?? null;
    p.long_ball_pct = s?.long_ball_accuracy_pct ?? null;
    p.final_third_passes = s?.accurate_final_third_passes ?? null;
  }

  // Collapse mid-season transfer stints into one season row (after Sofascore is
  // attached, so grouping can use the stable id and Sofascore is taken once).
  const rows = mergeStints(rawRows, sofaTeam);

  // Δ vs the previous Sofascore snapshot, matched by stable Sofascore id. Skipped
  // for merged (multi-club) rows — their summed totals aren't comparable to the
  // per-club snapshot.
  const prev = previousSofascore(league);
  const deltas = new Map<string, Partial<Record<MetricKey, number>>>();
  for (const p of rows) {
    if ((p.season_teams?.length ?? 1) > 1 || p.sofascore_id == null) continue;
    const pv = prev.byId.get(p.sofascore_id);
    if (!pv) continue;
    const d: Partial<Record<MetricKey, number>> = {};
    if (p.xg != null && pv.xg != null) d.xg = p.xg - pv.xg;
    if (p.xa != null && pv.xa != null) d.xa = p.xa - pv.xa;
    if (p.gk_goals_prevented != null && pv.goals_prevented != null)
      d.gk_goals_prevented = p.gk_goals_prevented - pv.goals_prevented;
    deltas.set(`${p.team}::${p.player}`, d);
  }
  return { rows, deltas, comparedTo: prev.createdAt };
}

function assemble(
  rows: RawPlayer[],
  deltas: Map<string, Partial<Record<MetricKey, number>>>,
  comparedTo: string | null,
  strengthOf?: (p: RawPlayer) => number,
): Board {
  const players = enrichPlayers(rows, loadModelConfig(), strengthOf).sort(
    (a, b) => (b.outputScore ?? -Infinity) - (a.outputScore ?? -Infinity),
  );
  for (const p of players) {
    const d = deltas.get(`${p.team}::${p.player}`);
    if (d) p.delta = d;
  }
  // Count players that actually carry an xG value (not just a name match) — so
  // a league the source omits xG for (Allsvenskan) honestly reads 0.
  const xgPresent = rows.filter((p) => p.xg != null).length;
  return { players, xgMatched: xgPresent, xgTotal: rows.length, comparedTo };
}

/** Enriched players for a league-season + Sofascore xG merged in, ranked by OUT. */
export function getEnrichedPlayers(league: string, season: string): Board {
  const { rows, deltas, comparedTo } = prepareRows(league, season);
  return assemble(rows, deltas, comparedTo);
}

// Data changes only on an ingest or a config tweak; key the cache on the file
// mtimes so app opens are instant reads and re-derive only when data actually
// changes (this is the "read from DB, don't recompute every time" fix).
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

let clCache: { version: string; board: Board } | null = null;

/** Every league's current-season players in ONE percentile pool, each league's
 *  non-rate output discounted by its strength coefficient — a fair cross-league
 *  ranking (the prospect finder). Cached until the DB/config changes. */
export function getCrossLeaguePlayers(): Board {
  const version = dataVersion();
  if (clCache && clCache.version === version) return clCache.board;
  const board = computeCrossLeaguePlayers();
  clCache = { version, board };
  return board;
}

function computeCrossLeaguePlayers(): Board {
  const strength = loadLeagueStrength();
  const allRows: RawPlayer[] = [];
  const deltas = new Map<string, Partial<Record<MetricKey, number>>>();
  let comparedTo: string | null = null;
  for (const ls of getLeagueSeasons()) {
    const r = prepareRows(ls.league, ls.season);
    allRows.push(...r.rows);
    for (const [k, v] of r.deltas) deltas.set(k, v);
    comparedTo = comparedTo ?? r.comparedTo;
  }
  return assemble(allRows, deltas, comparedTo, (p) => strength[p.league] ?? 1);
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
