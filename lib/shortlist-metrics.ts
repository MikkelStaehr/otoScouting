// Client-safe metric metadata for the shortlist (no fs / DB imports), shared by
// the server payload builder and the client filter UI.

import type { MetricKey } from "./types.ts";

export const SHORTLIST_GROUPS: { label: string; keys: MetricKey[] }[] = [
  { label: "Offensivt", keys: ["npg", "goals", "xg", "shots", "sot"] },
  { label: "Skabelse", keys: ["assists", "xa", "key_passes", "big_chances_created", "dribbles", "acc_crosses", "crosses"] },
  { label: "Defensivt", keys: ["tackles", "interceptions", "clearances", "blocks", "ball_recovery", "poss_won_att_third", "aerial_won", "duels_won_pct"] },
  { label: "Opspil", keys: ["pass_pct", "long_ball_pct", "final_third_passes"] },
  { label: "Målmand", keys: ["gk_save_pct", "gk_saves", "gk_clean_sheets", "gk_goals_prevented"] },
];
export const SHORTLIST_METRICS: MetricKey[] = SHORTLIST_GROUPS.flatMap((g) => g.keys);

// Percentile vectors for "similar to template" (GK compared on GK keys).
export const SIM_KEYS: { outfield: MetricKey[]; gk: MetricKey[] } = {
  outfield: [
    "npg", "xg", "assists", "xa", "key_passes", "big_chances_created", "dribbles",
    "acc_crosses", "shots", "sot", "tackles", "interceptions", "clearances", "blocks",
    "ball_recovery", "aerial_won", "duels_won_pct", "pass_pct", "final_third_passes",
  ],
  gk: ["gk_save_pct", "gk_saves", "gk_clean_sheets", "gk_goals_prevented"],
};

// Rates are shown with a %; everything else is a per-90 count.
export const RATE_METRICS = new Set<string>([
  "duels_won_pct", "pass_pct", "long_ball_pct", "gk_save_pct", "conv_pct", "sot_pct",
]);
