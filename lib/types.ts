// App-level types for the local FBref scouting tool.

/** Raw counting-stat row, one per player per league-season (mirrors scouting.db). */
export interface RawPlayer {
  league: string;
  season: string;
  season_label: string;
  team: string;
  player: string;
  nation: string | null;
  pos: string | null;
  age: number | null;
  born: number | null;
  mp: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  npg: number;
  pk: number;
  pkatt: number;
  shots: number;
  sot: number;
  interceptions: number;
  tackles_won: number;
  crosses: number;
  fouls: number;
  fouled: number;
  offsides: number;
  yellows: number;
  reds: number;
  // goalkeeping — null for non-keepers
  gk_saves: number | null;
  gk_ga: number | null;
  gk_sota: number | null;
  gk_clean_sheets: number | null;
  gk_save_pct: number | null;
  gk_pk_saved: number | null;
  weekly_wage: number | null;
  // Sofascore (Opta-style) fields, attached by the merge — null if unmatched
  xg: number | null;
  xa: number | null;
  gk_goals_prevented: number | null;
  // Sofascore defensive + build-up (also merged from sofascore_players)
  tackles: number | null;
  clearances: number | null;
  blocks: number | null;
  ball_recovery: number | null;
  poss_won_att_third: number | null;
  aerial_won: number | null;
  duels_won_pct: number | null;
  errors: number | null;
  pass_pct: number | null;
  passes: number | null;
  long_balls: number | null;
  long_ball_pct: number | null;
  final_third_passes: number | null;
}

/** Stat groups the table is divided into. */
export type GroupKey =
  | "offensive"
  | "expected"
  | "efficiency"
  | "defensive"
  | "buildup"
  | "goalkeeping";

/** Counting stats that can be expressed per-90 + percentile-ranked. */
export type MetricKey =
  | "goals"
  | "assists"
  | "npg"
  | "shots"
  | "sot"
  | "interceptions"
  | "tackles_won"
  | "fouled"
  | "crosses"
  | "fouls"
  | "gk_saves"
  | "gk_clean_sheets"
  | "gk_save_pct"
  | "gk_ga"
  | "gk_sota"
  | "gk_pk_saved"
  // derived efficiency ratios (computed, not stored)
  | "conv_pct"
  | "sot_pct"
  | "g_per_sot"
  // Sofascore (Opta-style) — real expected-goals data
  | "xg"
  | "xa"
  | "g_minus_xg"
  | "gk_goals_prevented"
  // Sofascore defensive + build-up (Opta-style)
  | "tackles"
  | "clearances"
  | "blocks"
  | "ball_recovery"
  | "poss_won_att_third"
  | "aerial_won"
  | "duels_won_pct"
  | "errors"
  | "pass_pct"
  | "passes"
  | "long_balls"
  | "long_ball_pct"
  | "final_third_passes";

/**
 * A player enriched with the model: per-90 (or rate) values, percentiles, and
 * the output score. per90/percentile are null for metrics the player has no
 * value for (e.g. a GK stat on an outfielder).
 */
export interface EnrichedPlayer extends RawPlayer {
  /** Whether the player clears the minMinutes qualification threshold. */
  qualified: boolean;
  /** stat -> per-90 value (or the raw rate for `rates` metrics), null if N/A. */
  per90: Record<MetricKey, number | null>;
  /** stat -> percentile (0-100) within its pool, null if N/A. */
  percentile: Record<MetricKey, number | null>;
  /** Goals + assists per 90 — the headline output rate. */
  gaPer90: number;
  /** Weighted average of per-90 percentiles (0-100). Null for keepers (OUT is
   * an outfield-output score and isn't meaningful for goalkeepers). */
  outputScore: number | null;
  /** Change vs the previous snapshot for metrics with history (xG/xA/GP). */
  delta?: Partial<Record<MetricKey, number>>;
}

/** Small payload for the ⌘K palette to search players. */
export interface PlayerIndexRow {
  key: string; // `${team}::${player}`
  player: string;
  team: string;
  pos: string | null;
}

/** Identifies which league-season is loaded. */
export interface LeagueSeason {
  league: string;
  season: string;
  season_label: string;
  playerCount: number;
}

// ── Team performance (Sofascore team season stats) ──

export interface RawTeam {
  league: string;
  season: string;
  season_label: string;
  sofascore_team_id: number;
  team: string;
  matches: number;
  goals: number;
  shots: number;
  sot: number;
  big_chances: number;
  big_chances_created: number;
  big_chances_missed: number;
  corners: number;
  possession: number | null;
  accurate_passes: number;
  pass_pct: number | null;
  accurate_long_balls: number;
  goals_conceded: number;
  shots_against: number;
  sot_against: number;
  big_chances_against: number;
  clean_sheets: number;
  interceptions: number;
  tackles: number;
  errors_to_shot_against: number;
  duels_won_pct: number | null;
  aerials_won_pct: number | null;
  avg_rating: number | null;
}

export type TeamMetricKey =
  | "goals"
  | "xg"
  | "shots"
  | "sot"
  | "big_chances"
  | "possession"
  | "pass_pct"
  | "goals_conceded"
  | "shots_against"
  | "big_chances_against"
  | "clean_sheets"
  | "interceptions"
  | "tackles"
  | "duels_won_pct"
  | "aerials_won_pct";

export interface EnrichedTeam extends RawTeam {
  /** Team xG/xA for — derived by summing player xG/xA. */
  xg: number;
  xa: number;
  /** Display value per metric: per-match for counts, rate as-is. */
  value: Record<TeamMetricKey, number | null>;
  /** Percentile within the 12-team league (invert applied so green = good). */
  percentile: Record<TeamMetricKey, number | null>;
}

export interface ModelConfig {
  minMinutes: number;
  groups: Record<GroupKey, MetricKey[]>;
  /** Metrics that are already ratios — shown as-is, not converted to per-90. */
  rates: MetricKey[];
  /** Lower-is-better metrics — their percentile is flipped so green = good. */
  invert: MetricKey[];
  /** Outfield output score weights (over offensive/defensive metrics). */
  outputScore: { weights: Partial<Record<MetricKey, number>> };
  /** Goalkeeper score weights (over goalkeeping metrics). */
  keeperScore: { weights: Partial<Record<MetricKey, number>> };
  /** Min-sample thresholds for the derived efficiency ratios. */
  derived?: { minShots?: number; minSot?: number };
}
