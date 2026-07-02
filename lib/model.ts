// The value/output model. Reads config/model.json at request time so groups,
// weights, the qualification threshold, rate metrics and inverted metrics are
// tunable live (just refresh — no rebuild).
//
// Percentiles are computed within a POOL: outfield metrics are ranked against
// qualified outfielders, goalkeeping metrics against qualified keepers. per-90
// normalises by minutes (the day-one denominator); `rates` are shown as-is;
// `invert` metrics (lower-is-better) get a flipped percentile so green = good.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  EnrichedPlayer,
  MetricKey,
  ModelConfig,
  RawPlayer,
} from "./types.ts";

const CONFIG_PATH = join(process.cwd(), "config", "model.json");

export function loadModelConfig(): ModelConfig {
  const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as ModelConfig;
  if (!raw.groups || Object.keys(raw.groups).length === 0) {
    throw new Error("config/model.json: groups must define at least one group");
  }
  return raw;
}

/** Flat, de-duplicated list of every metric across all groups. */
export function allMetrics(config: ModelConfig): MetricKey[] {
  return [...new Set(Object.values(config.groups).flat())];
}

const isGk = (m: MetricKey) => m.startsWith("gk_");

// Build-up / passing metrics that are ALSO meaningful for keepers — used to tell a
// sweeper / ball-playing keeper from a limited one. Keepers get a percentile on
// these ranked WITHIN the keeper pool (not vs outfielders), so they can be filtered
// and read like any other stat. Outfielders keep their normal outfield-pool rank.
const KEEPER_BUILDUP = new Set<MetricKey>([
  "pass_pct", "passes", "long_balls", "long_ball_pct", "final_third_passes",
]);

function per90(value: number, minutes: number): number {
  return minutes > 0 ? (value * 90) / minutes : 0;
}

/** Percentile (0-100) of v within an ascending-sorted array: share of pool ≤ v. */
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

export function enrichPlayers(
  players: RawPlayer[],
  config: ModelConfig,
  // Cross-league only: per-player league-strength coefficient. Discounts a
  // player's non-rate output for the percentile POOL (and thus OUT), while the
  // displayed per-90 values stay raw. Default 1 → single-league, unchanged.
  strengthOf: (p: RawPlayer) => number = () => 1,
): EnrichedPlayer[] {
  const metrics = allMetrics(config);
  const rates = new Set(config.rates);
  const invert = new Set(config.invert);

  // Derived efficiency ratios — computed, not stored. Null below a min sample
  // so "1 shot, 1 goal = 100%" doesn't masquerade as elite finishing.
  const minShots = config.derived?.minShots ?? 20;
  const minSot = config.derived?.minSot ?? 8;
  const DERIVED: Partial<Record<MetricKey, (p: RawPlayer) => number | null>> = {
    conv_pct: (p) => (p.shots >= minShots ? (p.goals / p.shots) * 100 : null),
    sot_pct: (p) => (p.shots >= minShots ? (p.sot / p.shots) * 100 : null),
    g_per_sot: (p) => (p.sot >= minSot ? p.goals / p.sot : null),
    // Finishing vs expectation — real now that we have Sofascore xG.
    g_minus_xg: (p) =>
      p.xg !== null && p.shots >= minShots ? p.goals - p.xg : null,
  };

  // A metric's value for a player: derived formula, else null/rate/per-90.
  // This is the DISPLAY value (what the table shows) — never league-adjusted.
  const valueOf = (p: RawPlayer, m: MetricKey): number | null => {
    const derive = DERIVED[m];
    if (derive) return derive(p);
    const raw = (p as unknown as Record<string, number | null>)[m];
    if (raw === null || raw === undefined) return null;
    return rates.has(m) ? raw : per90(raw, p.minutes);
  };

  // Value used for the percentile POOL: same as display, but non-rate output is
  // scaled by the player's league coefficient so cross-league ranks are fair.
  // Rates keep their unit (a pass% is a pass%). Single-league → coef 1 → equal.
  const rankValue = (p: RawPlayer, m: MetricKey): number | null => {
    const v = valueOf(p, m);
    if (v === null) return null;
    return rates.has(m) ? v : v * strengthOf(p);
  };

  const qualified = (p: RawPlayer) => p.minutes >= config.minMinutes;
  const isKeeper = (p: RawPlayer) => p.gk_saves !== null;

  // Reference distributions per metric, from the relevant qualified pool.
  const outfieldPool = players.filter((p) => qualified(p) && !isKeeper(p));
  const keeperPool = players.filter((p) => qualified(p) && isKeeper(p));
  const sorted = {} as Record<MetricKey, number[]>;
  for (const m of metrics) {
    const pool = isGk(m) ? keeperPool : outfieldPool;
    sorted[m] = pool
      .map((p) => rankValue(p, m))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
  }
  // Keeper-pool distributions for the shared build-up metrics (keeper-vs-keeper).
  const sortedKeeper = {} as Record<MetricKey, number[]>;
  for (const m of metrics) {
    if (!KEEPER_BUILDUP.has(m)) continue;
    sortedKeeper[m] = keeperPool
      .map((p) => rankValue(p, m))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
  }

  // Weighted average of percentiles, given a weight map.
  const weightedScore = (
    percentile: Record<MetricKey, number | null>,
    weights: Partial<Record<MetricKey, number>>,
  ): number => {
    let score = 0;
    let wSum = 0;
    for (const [m, w] of Object.entries(weights)) {
      const pct = percentile[m as MetricKey];
      if (pct === null || pct === undefined || !w) continue;
      score += pct * w;
      wSum += w;
    }
    return wSum > 0 ? score / wSum : 0;
  };

  // Round on the way out — the client-facing payload is mostly these floats, and
  // full precision is wasted (per-90 shows 2 decimals, percentiles are rounded).
  const r3 = (v: number | null) => (v == null ? null : Math.round(v * 1000) / 1000);
  const r1 = (v: number) => Math.round(v * 10) / 10;

  return players.map((p) => {
    const keeper = isKeeper(p);
    const per90Map = {} as Record<MetricKey, number | null>;
    const percentile = {} as Record<MetricKey, number | null>;
    for (const m of metrics) {
      per90Map[m] = r3(valueOf(p, m)); // raw display value (never league-adjusted)
      // Only rank a player on metrics of their own class: keepers on GK stats,
      // outfielders on the rest. Otherwise a keeper's 0 goals would percentile
      // against outfielders (tie-inflated) and read as a real ranking.
      const rv = rankValue(p, m); // league-adjusted value for ranking
      const inPool = isGk(m) ? keeper : !keeper;
      // Keepers also get a keeper-vs-keeper rank on the shared build-up metrics.
      const keeperBuildup = keeper && !inPool && KEEPER_BUILDUP.has(m);
      if (rv === null || (!inPool && !keeperBuildup)) {
        percentile[m] = null;
      } else {
        const pool = keeperBuildup ? sortedKeeper[m]! : sorted[m];
        const pct = percentileOf(pool, rv);
        percentile[m] = r1(invert.has(m) ? 100 - pct : pct);
      }
    }

    // Role-relative OUT: keepers scored on goalkeeping, outfielders on output.
    const outputScore = keeper
      ? weightedScore(percentile, config.keeperScore.weights)
      : weightedScore(percentile, config.outputScore.weights);

    return {
      ...p,
      qualified: qualified(p),
      per90: per90Map,
      percentile,
      gaPer90: per90(p.goals + p.assists, p.minutes),
      outputScore,
    };
  });
}
