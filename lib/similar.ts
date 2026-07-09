// Player detail + statistical similarity. Each player is a vector of percentile
// values (already 0-100 and league-strength adjusted), so the distance between
// two vectors is how alike their profiles are. Similarity = 100 − RMSE over the
// metrics both players have. Candidates are the same class (outfield/GK) and, for
// outfielders, the same primary position — a CB is matched to CBs, not wingers.

import { getCrossLeaguePlayers, getFullPoolPlayers } from "./players.ts";
import { loadBenchmarkLeagues } from "./league-config.ts";
import { loadModelConfig } from "./model.ts";
import { getHeatmap, getAllCentroids, type Heatmap } from "./heatmap.ts";
import { classifyRole, type RoleResult } from "./roles.ts";
import { METRIC_NAME, GROUP_LABEL } from "./metrics.ts";
import type { EnrichedPlayer, GroupKey, MetricKey } from "./types.ts";

const SIM_OUTFIELD: MetricKey[] = [
  "npg", "xg", "shots", "sot", "key_passes", "big_chances_created", "xa",
  "dribbles", "acc_crosses", "tackles", "interceptions", "clearances", "blocks",
  "ball_recovery", "aerial_won", "duels_won_pct", "pass_pct", "long_balls",
  "final_third_passes",
];
const SIM_GK: MetricKey[] = [
  "gk_goals_prevented", "gk_save_pct", "gk_clean_sheets", "gk_saves", "gk_ga", "gk_sota",
];

const posGroup = (pos: string | null): string => {
  const t = (pos ?? "").split(",")[0]?.trim() ?? "";
  return ["GK", "DF", "MF", "FW"].includes(t) ? t : "?";
};

export interface SimStat {
  key: string;
  label: string;
  value: number | null;
  pct: number | null;
}
export interface SimGroup {
  label: string;
  stats: SimStat[];
}
export interface SimilarPlayer {
  key: string;
  player: string;
  team: string;
  league: string;
  age: number | null;
  pos: string | null;
  sim: number;
}
export interface FlatStat {
  label: string;
  value: number | null;
  pct?: boolean; // render as a percentage
}
/** Comp-based value band: what this player's statistical + age peers (across the
 *  full pool incl. big-5) are worth on Transfermarkt. The gap between his own value
 *  and the peer median is the signal — below = potential upside, above = a market
 *  premium (hype/platform the stats don't capture). */
export interface ValueSpread {
  value: number | null; // his own TM market value (euros)
  p25: number; // peer 25th percentile value
  median: number; // peer median = the performance-implied value
  p75: number; // peer 75th percentile
  peerCount: number;
  topPeers: { key: string; player: string; team: string; league: string; value: number; sim: number }[];
}
export interface PlayerDetail {
  key: string;
  sid: number | null; // sofascore_id (stable id for watchlists)
  player: string;
  team: string;
  league: string;
  age: number | null;
  pos: string | null;
  posGroup: string;
  nation: string | null;
  height: number | null; // cm (Sofascore bio)
  foot: string | null; // Right / Left / Both
  minutes: number;
  out: number | null;
  marketValue: number | null; // Transfermarkt market value in euros
  flat: FlatStat[]; // plain season totals (position-appropriate)
  seasonTeams: string[] | null; // >1 when he changed club mid-season (current first)
  role: RoleResult | null; // data-driven role (from positioning + stats)
  heatmap: Heatmap | null;
  groups: SimGroup[];
  similar: SimilarPlayer[];
  benchmarkSimilar: SimilarPlayer[]; // closest big-5 players ("plays like PL X")
  valueSpread: ValueSpread | null; // comp-based value band (null if too few peers)
}

/** Closest players to `target` within `candidates` (same class/position), by RMSE
 *  over percentile vectors. `target` and `candidates` must share one percentile
 *  pool for the distance to be meaningful. */
function similarTo(
  target: EnrichedPlayer,
  candidates: EnrichedPlayer[],
  isGk: boolean,
  grp: string,
  limit: number,
): SimilarPlayer[] {
  const simKeys = isGk ? SIM_GK : SIM_OUTFIELD;
  const tv = simKeys.map((k) => target.percentile[k]);
  const selfKey = `${target.team}::${target.player}`;
  return candidates
    .filter(
      (p) =>
        `${p.team}::${p.player}` !== selfKey &&
        (p.gk_saves != null) === isGk &&
        (p.minutes ?? 0) >= 540 &&
        (isGk || posGroup(p.pos) === grp),
    )
    .map((p) => {
      const pv = simKeys.map((k) => p.percentile[k]);
      let sum = 0;
      let n = 0;
      for (let i = 0; i < simKeys.length; i++) {
        const a = tv[i];
        const b = pv[i];
        if (a != null && b != null) {
          sum += (a - b) ** 2;
          n++;
        }
      }
      if (n < Math.min(6, simKeys.length)) return null;
      return { p, sim: Math.max(0, Math.round(100 - Math.sqrt(sum / n))) };
    })
    .filter((x): x is { p: EnrichedPlayer; sim: number } => x != null)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, limit)
    .map(({ p, sim }) => ({
      key: `${p.team}::${p.player}`,
      player: p.player,
      team: p.team,
      league: p.league,
      age: p.age ?? null,
      pos: p.pos,
      sim,
    }));
}

/** Value band from statistical + age peers (same position, ±2 years, ≥900 min) that
 *  carry a market value — a comp valuation. Null if fewer than 5 peers. */
function computeValueSpread(
  target: EnrichedPlayer,
  pool: EnrichedPlayer[],
  isGk: boolean,
  grp: string,
): ValueSpread | null {
  const simKeys = isGk ? SIM_GK : SIM_OUTFIELD;
  const tv = simKeys.map((k) => target.percentile[k]);
  const selfKey = `${target.team}::${target.player}`;
  const scored = pool
    .filter(
      (p) =>
        `${p.team}::${p.player}` !== selfKey &&
        (p.gk_saves != null) === isGk &&
        (isGk || posGroup(p.pos) === grp) &&
        (p.minutes ?? 0) >= 900 &&
        p.market_value != null &&
        Math.abs((p.age ?? 99) - (target.age ?? 0)) <= 2,
    )
    .map((p) => {
      const pv = simKeys.map((k) => p.percentile[k]);
      let sum = 0;
      let n = 0;
      for (let i = 0; i < simKeys.length; i++) {
        const a = tv[i];
        const b = pv[i];
        if (a != null && b != null) {
          sum += (a - b) ** 2;
          n++;
        }
      }
      if (n < Math.min(6, simKeys.length)) return null;
      return { p, sim: Math.max(0, Math.round(100 - Math.sqrt(sum / n))) };
    })
    .filter((x): x is { p: EnrichedPlayer; sim: number } => x != null)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 25);
  if (scored.length < 5) return null;
  const vals = scored.map((x) => x.p.market_value as number).sort((a, b) => a - b);
  const q = (f: number) => vals[Math.floor(f * (vals.length - 1))]!;
  return {
    value: target.market_value ?? null,
    p25: q(0.25),
    median: q(0.5),
    p75: q(0.75),
    peerCount: scored.length,
    topPeers: scored.slice(0, 5).map((x) => ({
      key: `${x.p.team}::${x.p.player}`,
      player: x.p.player,
      team: x.p.team,
      league: x.p.league,
      value: x.p.market_value as number,
      sim: x.sim,
    })),
  };
}

export function getPlayerDetail(key: string): PlayerDetail | null {
  const dev = getCrossLeaguePlayers().players;
  const full = getFullPoolPlayers().players;
  const devTarget = dev.find((p) => `${p.team}::${p.player}` === key) ?? null;
  const fullTarget = full.find((p) => `${p.team}::${p.player}` === key) ?? null;
  // Development players keep the board's percentile basis; a big-5 player (not in
  // the dev pool, opened from its own league view) falls back to the full pool.
  const target = devTarget ?? fullTarget;
  if (!target) return null;

  const isGk = target.gk_saves != null;
  const grp = posGroup(target.pos);

  // Dev lookalikes: development players only, on the board basis (a big-5 target
  // shows none — you don't scout the big-5 against each other here).
  const similar = devTarget ? similarTo(devTarget, dev, isGk, grp, 8) : [];

  // Benchmark lookalikes: target vs the big-5, both in the FULL pool (one percentile
  // basis), so "your profile plays like [PL player X]" is meaningful.
  const benchmarkLeagues = loadBenchmarkLeagues();
  const benchmarkSimilar = fullTarget
    ? similarTo(fullTarget, full.filter((p) => benchmarkLeagues.has(p.league)), isGk, grp, 5)
    : [];

  // Value band from statistical + age peers across the full pool (dev + big-5).
  const valueSpread = fullTarget ? computeValueSpread(fullTarget, full, isGk, grp) : null;

  const config = loadModelConfig();
  const displayGroups: GroupKey[] = isGk
    ? ["goalkeeping", "buildup"] // buildup shows sweeper / ball-playing profile
    : ["offensive", "expected", "creation", "efficiency", "defensive", "buildup"];
  const groups: SimGroup[] = displayGroups
    .filter((g) => config.groups[g]?.length)
    .map((g) => ({
      label: GROUP_LABEL[g],
      stats: config.groups[g].map((k) => ({
        key: k,
        label: METRIC_NAME[k],
        value: target.per90[k],
        pct: target.percentile[k],
      })),
    }));

  return {
    key,
    sid: target.sofascore_id ?? null,
    player: target.player,
    team: target.team,
    league: target.league,
    age: target.age ?? null,
    pos: target.pos,
    posGroup: grp,
    nation: target.nation,
    height: target.height ?? null,
    foot: target.foot ?? null,
    minutes: target.minutes,
    out: target.outputScore == null ? null : Math.round(target.outputScore),
    marketValue: target.market_value ?? null,
    flat: isGk
      ? [
          { label: "Kampe", value: target.mp },
          { label: "Mål imod", value: target.gk_ga },
          { label: "Clean sheets", value: target.gk_clean_sheets },
          { label: "Redning%", value: target.gk_save_pct, pct: true },
        ]
      : [
          { label: "Kampe", value: target.mp },
          { label: "Mål", value: target.goals },
          { label: "Assists", value: target.assists },
        ],
    seasonTeams: target.season_teams ?? null,
    role: classifyRole(
      grp,
      target.percentile as unknown as Record<string, number | null>,
      target.sofascore_id != null ? getAllCentroids().get(target.sofascore_id) ?? null : null,
    ),
    heatmap: getHeatmap(target.league, target.season, target.sofascore_id),
    groups,
    similar,
    benchmarkSimilar,
    valueSpread,
  };
}
