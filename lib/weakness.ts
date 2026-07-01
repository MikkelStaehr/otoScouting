// Team defensive weakness map: for each defensive zone (left / central / right),
// find the player who covers it (from his season heatmap centroid), and score how
// strong he is there (average of his defensive percentiles). A weak zone = a soft
// covering player — exactly the "their left-back wins too few duels" reasoning.
// Phase 2 (fit-matching) then finds DB players for the weak zones.

import { getDb } from "./db.ts";
import { getCrossLeaguePlayers } from "./players.ts";
import { normTeam } from "./merge.ts";
import type { EnrichedPlayer, MetricKey } from "./types.ts";

const DEF: { key: MetricKey; label: string }[] = [
  { key: "duels_won_pct", label: "Duel%" },
  { key: "tackles", label: "Tacklinger" },
  { key: "interceptions", label: "Erobringer" },
  { key: "aerial_won", label: "Luftdueller" },
  { key: "clearances", label: "Clearances" },
];

const ZONE_LABEL = { left: "Venstre side", central: "Central forsvar", right: "Højre side" } as const;
type Side = keyof typeof ZONE_LABEL;

function centroid(grid: number[], w: number, h: number): { cx: number; cy: number } | null {
  let tot = 0, sx = 0, sy = 0;
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const v = grid[r * w + c]!;
      tot += v;
      sx += ((c + 0.5) / w) * v;
      sy += ((r + 0.5) / h) * v;
    }
  return tot > 0 ? { cx: sx / tot, cy: sy / tot } : null;
}

const sideOf = (cy: number): Side => (cy < 0.36 ? "left" : cy > 0.64 ? "right" : "central");

function strengthOf(p: EnrichedPlayer): number | null {
  const vals = DEF.map((d) => p.percentile[d.key]).filter((v): v is number => v != null);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

export interface Fit {
  key: string;
  player: string;
  team: string;
  league: string;
  strength: number;
  minutes: number;
  age: number | null;
}

// Every deep (defensive-third) player across all leagues, tagged with the side he
// covers and his defensive strength — the pool the fit-matcher draws upgrades from.
interface PoolPlayer extends Fit {
  side: Side;
}
let poolCache: { version: number; pool: PoolPlayer[] } | null = null;

function getDefensivePool(): PoolPlayer[] {
  const db = getDb();
  let version = 0;
  try {
    version = (db.prepare("SELECT COUNT(*) AS n FROM player_heatmaps").get() as { n: number }).n;
  } catch {
    return [];
  }
  if (poolCache && poolCache.version === version) return poolCache.pool;

  const { players } = getCrossLeaguePlayers();
  const byId = new Map<number, EnrichedPlayer>();
  for (const p of players) if (p.sofascore_id != null) byId.set(p.sofascore_id, p);

  const rows = db
    .prepare("SELECT league, player_id, grid_w, grid_h, grid FROM player_heatmaps")
    .all() as { league: string; player_id: number; grid_w: number; grid_h: number; grid: string }[];

  const pool: PoolPlayer[] = [];
  for (const r of rows) {
    const p = byId.get(r.player_id);
    if (!p || p.league !== r.league || p.gk_saves != null || (p.minutes ?? 0) < 900) continue;
    const ct = centroid(JSON.parse(r.grid) as number[], r.grid_w, r.grid_h);
    if (!ct || ct.cx >= 0.5) continue;
    const strength = strengthOf(p);
    if (strength == null) continue;
    pool.push({
      key: `${p.team}::${p.player}`,
      player: p.player,
      team: p.team,
      league: p.league,
      strength,
      minutes: p.minutes,
      age: p.age ?? null,
      side: sideOf(ct.cy),
    });
  }
  poolCache = { version, pool };
  return pool;
}

export interface ZoneCover {
  zone: string;
  side: Side;
  player: string;
  key: string; // `${team}::${player}` for opening the player modal
  minutes: number;
  strength: number | null; // 0-100 composite defensive percentile
  metrics: { label: string; pct: number | null }[];
  fits: Fit[]; // upgrade candidates for this zone, across all leagues
}
export interface TeamWeakness {
  team: string;
  league: string;
  zones: ZoneCover[];
  goalsAgainst: number | null; // per match
  bigChancesAgainst: number | null;
}

export function getTeamWeakness(league: string, team: string): TeamWeakness | null {
  const { players } = getCrossLeaguePlayers();
  const nt = normTeam(team);
  const squad = players.filter(
    (p) =>
      p.league === league &&
      normTeam(p.team) === nt &&
      p.gk_saves == null &&
      (p.minutes ?? 0) >= 600 &&
      p.sofascore_id != null,
  );
  if (!squad.length) return null;
  const season = squad[0]!.season;
  const teamName = squad[0]!.team;

  const ids = squad.map((p) => p.sofascore_id!) as number[];
  const rows = getDb()
    .prepare(
      `SELECT player_id, grid_w, grid_h, grid FROM player_heatmaps
        WHERE league = ? AND season = ? AND player_id IN (${ids.map(() => "?").join(",")})`,
    )
    .all(league, season, ...ids) as {
    player_id: number;
    grid_w: number;
    grid_h: number;
    grid: string;
  }[];
  const hm = new Map(
    rows.map((r) => [r.player_id, { w: r.grid_w, h: r.grid_h, grid: JSON.parse(r.grid) as number[] }]),
  );

  // Assign each deep player to a lateral zone from his heatmap centroid.
  const byZone: Record<Side, { p: EnrichedPlayer; mins: number }[]> = { left: [], central: [], right: [] };
  for (const p of squad) {
    const h = hm.get(p.sofascore_id!);
    if (!h) continue;
    const ct = centroid(h.grid, h.w, h.h);
    if (!ct || ct.cx >= 0.5) continue; // keep only defensive-third players
    byZone[sideOf(ct.cy)].push({ p, mins: p.minutes });
  }

  const pool = getDefensivePool();
  const zones: ZoneCover[] = (Object.keys(ZONE_LABEL) as Side[]).map((side) => {
    const primary = byZone[side].sort((a, b) => b.mins - a.mins)[0];
    if (!primary) {
      return { zone: ZONE_LABEL[side], side, player: "—", key: "", minutes: 0, strength: null, metrics: [], fits: [] };
    }
    const p = primary.p;
    const strength = strengthOf(p);
    // Fit candidates: same side, from other clubs, stronger than the incumbent.
    const fits: Fit[] = pool
      .filter((c) => c.side === side && normTeam(c.team) !== nt && (strength == null || c.strength > strength))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 6)
      .map(({ side: _s, ...f }) => f);
    return {
      zone: ZONE_LABEL[side],
      side,
      player: p.player,
      key: `${p.team}::${p.player}`,
      minutes: p.minutes,
      strength,
      metrics: DEF.map((d) => ({ label: d.label, pct: p.percentile[d.key] ?? null })),
      fits,
    };
  });

  // Team's conceding context (matched loosely on name).
  let goalsAgainst: number | null = null;
  let bigChancesAgainst: number | null = null;
  try {
    const tRows = getDb()
      .prepare(`SELECT team, goals_conceded, big_chances_against, matches FROM sofascore_teams WHERE league = ?`)
      .all(league) as { team: string; goals_conceded: number; big_chances_against: number; matches: number }[];
    const t = tRows.find((r) => normTeam(r.team) === nt);
    if (t && t.matches) {
      goalsAgainst = Math.round((t.goals_conceded / t.matches) * 100) / 100;
      bigChancesAgainst = Math.round((t.big_chances_against / t.matches) * 100) / 100;
    }
  } catch {
    /* teams table absent */
  }

  return { team: teamName, league, zones, goalsAgainst, bigChancesAgainst };
}
