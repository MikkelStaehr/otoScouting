// App-facing queries. Returns small, browser-safe view models — the enriched
// player array for a league-season is computed server-side once per request.

import { statSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./db.ts";
import { enrichPlayers, loadModelConfig } from "./model.ts";
import { loadLeagueStrength, loadBenchmarkLeagues } from "./league-config.ts";
import { matchSofascore } from "./merge.ts";
import { transfermarktRows } from "./transfermarkt.ts";
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

// The previous Sofascore snapshot (for Δ vs last fetch), loaded ONCE for all
// leagues and grouped by league — previousSofascore() was called per league, each
// time aggregating MAX(snapshot_id) + scanning the whole ~28k-row history table,
// which dominated the cold cross-league build. Cached on the data version.
let prevSnapCache: {
  version: string;
  createdAt: string | null;
  byLeague: Map<string, Map<number, SofaRow>>;
  all: Map<number, SofaRow> | null; // used when history predates the league column
} | null = null;

function loadPrevSnapshot() {
  const version = dataVersion();
  if (prevSnapCache && prevSnapCache.version === version) return prevSnapCache;
  const empty = { version, createdAt: null, byLeague: new Map<string, Map<number, SofaRow>>(), all: null };
  try {
    const db = getDb();
    const snap = db.prepare(`SELECT MAX(snapshot_id) AS sid FROM sofascore_players_history`).get() as { sid: number | null };
    if (!snap?.sid) return (prevSnapCache = empty);
    const hasLeague = (db.prepare(`PRAGMA table_info(sofascore_players_history)`).all() as { name: string }[]).some((c) => c.name === "league");
    const createdAt = (db.prepare(`SELECT created_at FROM snapshots WHERE id = ?`).get(snap.sid) as { created_at: string } | undefined)?.created_at ?? null;
    const byLeague = new Map<string, Map<number, SofaRow>>();
    let all: Map<number, SofaRow> | null = null;
    if (hasLeague) {
      const rows = db.prepare(
        `SELECT player_id, xg, xa, goals_prevented, league FROM sofascore_players_history WHERE snapshot_id = ?`,
      ).all(snap.sid) as unknown as (SofaRow & { league: string })[];
      for (const r of rows) {
        let m = byLeague.get(r.league);
        if (!m) byLeague.set(r.league, (m = new Map()));
        m.set(r.player_id, r);
      }
    } else {
      const rows = db.prepare(
        `SELECT player_id, xg, xa, goals_prevented FROM sofascore_players_history WHERE snapshot_id = ?`,
      ).all(snap.sid) as unknown as SofaRow[];
      all = new Map(rows.map((r) => [r.player_id, r]));
    }
    return (prevSnapCache = { version, createdAt, byLeague, all });
  } catch {
    return (prevSnapCache = empty);
  }
}

/** Previous Sofascore snapshot for one league (for Δ vs last fetch), from the cache. */
function previousSofascore(league: string): { byId: Map<number, SofaRow>; createdAt: string | null } {
  const c = loadPrevSnapshot();
  return { byId: c.all ?? c.byLeague.get(league) ?? new Map(), createdAt: c.createdAt };
}

/** Static player bio (height + foot) keyed on Sofascore id, loaded once per data
 *  version. Empty if the backfill (pipeline/fetch_bio.py) hasn't run yet. */
let bioCache: { version: string; byId: Map<number, { height: number | null; foot: string | null }> } | null = null;
function loadBio(): Map<number, { height: number | null; foot: string | null }> {
  const version = dataVersion();
  if (bioCache && bioCache.version === version) return bioCache.byId;
  const byId = new Map<number, { height: number | null; foot: string | null }>();
  try {
    const rows = getDb()
      .prepare("SELECT player_id, height, foot FROM player_bio")
      .all() as { player_id: number; height: number | null; foot: string | null }[];
    for (const r of rows) byId.set(r.player_id, { height: r.height, foot: r.foot });
  } catch {
    /* player_bio may not exist yet — bio just reads null everywhere */
  }
  bioCache = { version, byId };
  return byId;
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
  // Current club first, then the other DISTINCT clubs (most minutes first). Distinct
  // so an FBref double-listing at the same club doesn't read as a transfer.
  const teams = [primary.team, ...byMin.filter((p) => p !== primary).map((p) => p.team)];
  merged.season_teams = [...new Set(teams)];
  return merged as unknown as RawPlayer;
}

/** Collapse same-player rows within one league-season into one. Two rows are the
 *  same player if they share a normalised name (a transfer stint — FBref keeps one
 *  name across clubs) OR the same non-null Sofascore id (FBref sometimes double-lists
 *  a player under two name variants at one club, e.g. "Bar Lin" / "Bar Enosh Lin" —
 *  both match the same Sofascore player). Union-find over both keys. */
function mergeStints(rows: RawPlayer[], sofaTeam: Map<RawPlayer, string | null>): RawPlayer[] {
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r]!;
    while (parent[i] !== r) {
      const next = parent[i]!;
      parent[i] = r;
      i = next;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  const byName = new Map<string, number>();
  const bySid = new Map<number, number>();
  rows.forEach((p, i) => {
    const nk = nmKey(p.player);
    if (byName.has(nk)) union(i, byName.get(nk)!);
    else byName.set(nk, i);
    if (p.sofascore_id != null) {
      if (bySid.has(p.sofascore_id)) union(i, bySid.get(p.sofascore_id)!);
      else bySid.set(p.sofascore_id, i);
    }
  });
  const comps = new Map<number, RawPlayer[]>();
  rows.forEach((p, i) => {
    const r = find(i);
    (comps.get(r) ?? comps.set(r, []).get(r)!).push(p);
  });
  const out: RawPlayer[] = [];
  for (const g of comps.values()) {
    if (g.length === 1) {
      out.push(g[0]!);
      continue;
    }
    // ≥2 distinct non-null Sofascore ids in one component → different people caught
    // by a shared name; keep them separate (safe over-split in rare tangles).
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
  const bio = loadBio();
  const sofaTeam = new Map<RawPlayer, string | null>(); // current club (from Sofascore)
  for (const p of rawRows) {
    const s = map.get(`${p.team}::${p.player}`);
    sofaTeam.set(p, s?.team ?? null);
    p.sofascore_id = s?.player_id ?? null;
    const b = s?.player_id != null ? bio.get(s.player_id) : null;
    p.height = b?.height ?? null;
    p.foot = b?.foot ?? null;
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

  // Attach Transfermarkt market value (matched by name+team, once per collapsed
  // row so a transfer doesn't double it). The "value" side of value-per-output.
  const { map: tmMap } = matchSofascore(rows, transfermarktRows(league, season));
  for (const p of rows) {
    const tm = tmMap.get(`${p.team}::${p.player}`);
    p.market_value = tm?.market_value ?? null;
    p.tm_id = tm?.tm_id ?? null;
  }

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

// prepareRows (the FBref↔Sofascore↔Transfermarkt matching + stint merge) is the
// read-layer's heaviest step. Both the single-league board and the two cross-league
// pools (dev-only and full) prepare the same leagues, so cache the result per
// (league, season), keyed on the data version. Callers must not mutate the rows.
let prepCache: { version: string; map: Map<string, ReturnType<typeof prepareRows>> } | null = null;

function preparedRows(league: string, season: string): ReturnType<typeof prepareRows> {
  const version = dataVersion();
  if (!prepCache || prepCache.version !== version) prepCache = { version, map: new Map() };
  const k = `${league}::${season}`;
  let r = prepCache.map.get(k);
  if (!r) {
    r = prepareRows(league, season);
    prepCache.map.set(k, r);
  }
  return r;
}

/** Enriched players for a league-season + Sofascore xG merged in, ranked by OUT. */
export function getEnrichedPlayers(league: string, season: string): Board {
  const { rows, deltas, comparedTo } = preparedRows(league, season);
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
let fullCache: { version: string; board: Board } | null = null;

/** Every league's current-season players in ONE percentile pool, each league's
 *  non-rate output discounted by its strength coefficient — a fair cross-league
 *  ranking (the prospect finder). Excludes the benchmark (big-5) tier. Cached. */
export function getCrossLeaguePlayers(): Board {
  const version = dataVersion();
  if (clCache && clCache.version === version) return clCache.board;
  const board = computeCrossLeaguePlayers(false);
  clCache = { version, board };
  return board;
}

/** Like getCrossLeaguePlayers but INCLUDING the big-5 benchmark tier, in one
 *  percentile pool — so a development player and a big-5 player have comparable
 *  vectors for cross-tier similarity ("plays like PL player X"). Cached. */
export function getFullPoolPlayers(): Board {
  const version = dataVersion();
  if (fullCache && fullCache.version === version) return fullCache.board;
  const board = computeCrossLeaguePlayers(true);
  fullCache = { version, board };
  return board;
}

function computeCrossLeaguePlayers(includeBenchmark: boolean): Board {
  const strength = loadLeagueStrength();
  // The benchmark (big-5) tier anchors the strength scale but is NOT scouted, so
  // it stays out of the scouting pool — otherwise elite players would crowd the
  // development-league prospects the board is for. The full pool (for cross-tier
  // similarity) keeps them in.
  const benchmark = includeBenchmark ? new Set<string>() : loadBenchmarkLeagues();
  const allRows: RawPlayer[] = [];
  const deltas = new Map<string, Partial<Record<MetricKey, number>>>();
  let comparedTo: string | null = null;
  for (const ls of getLeagueSeasons()) {
    if (benchmark.has(ls.league)) continue;
    const r = preparedRows(ls.league, ls.season);
    allRows.push(...r.rows);
    for (const [k, v] of r.deltas) deltas.set(k, v);
    comparedTo = comparedTo ?? r.comparedTo;
  }

  // A player who moved between two of our leagues this season appears once per
  // league. On the cross-league board show him ONCE — his primary league (most
  // minutes) — and note the other club on season_teams so the card still shows it.
  // Keyed on the stable Sofascore id (rows without one can't be safely deduped).
  const keeper = new Map<number, RawPlayer>();
  for (const p of allRows) {
    if (p.sofascore_id == null) continue;
    const cur = keeper.get(p.sofascore_id);
    if (!cur || (p.minutes ?? 0) > (cur.minutes ?? 0)) keeper.set(p.sofascore_id, p);
  }
  const otherClubs = new Map<number, string[]>();
  for (const p of allRows) {
    if (p.sofascore_id == null || keeper.get(p.sofascore_id) === p) continue;
    (otherClubs.get(p.sofascore_id) ?? otherClubs.set(p.sofascore_id, []).get(p.sofascore_id)!).push(p.team);
  }
  const seen = new Set<number>();
  const rows: RawPlayer[] = [];
  for (const p of allRows) {
    if (p.sofascore_id == null) {
      rows.push(p);
      continue;
    }
    if (seen.has(p.sofascore_id)) continue;
    seen.add(p.sofascore_id);
    const keep0 = keeper.get(p.sofascore_id)!;
    const extra = otherClubs.get(p.sofascore_id);
    // Clone (never mutate the cached prepared row) when folding in the other club.
    const keep = extra?.length
      ? { ...keep0, season_teams: [...new Set([...(keep0.season_teams ?? [keep0.team]), ...extra])] }
      : keep0;
    rows.push(keep);
  }
  return assemble(rows, deltas, comparedTo, (p) => strength[p.league] ?? 1);
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

let playerIndexCache: { version: string; index: PlayerIndexRow[] } | null = null;

/** Every player across every league-season, for the ⌘K palette — so search finds
 *  anyone, not just the default league. Deduped by key, cached on the data version. */
export function getAllPlayerIndex(): PlayerIndexRow[] {
  const version = dataVersion();
  if (playerIndexCache && playerIndexCache.version === version) return playerIndexCache.index;
  const seen = new Set<string>();
  const out: PlayerIndexRow[] = [];
  for (const ls of getLeagueSeasons()) {
    for (const p of rawPlayers(ls.league, ls.season)) {
      const key = `${p.team}::${p.player}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, player: p.player, team: p.team, pos: p.pos });
    }
  }
  out.sort((a, b) => a.player.localeCompare(b.player));
  playerIndexCache = { version, index: out };
  return out;
}
