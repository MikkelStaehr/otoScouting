// Player style profile — a handful of composite "DNA" dimensions, each a weighted
// blend of the stats we already percentile (0-100, league-strength adjusted). Where
// a single stat says one thing, these say WHAT KIND of player: a finisher, a creator,
// a presser, a defender. Together they paint the picture the raw stats + heatmap
// don't on their own. Spatial signal enters through the inherently-positional stats
// (possession won in the attacking third, final-third passes).

import type { MetricKey } from "./types.ts";

interface Dim {
  key: string;
  label: string;
  stats: [MetricKey, number][];
}

// Weights are relative within a dimension (renormalised over the stats that exist).
const DIMS: Dim[] = [
  { key: "finish", label: "Afslutning", stats: [["g_minus_xg", 0.5], ["sot", 0.25], ["conv_pct", 0.25]] },
  { key: "create", label: "Chanceskabelse", stats: [["xa", 0.4], ["key_passes", 0.3], ["big_chances_created", 0.3]] },
  { key: "carry", label: "Føring & dribling", stats: [["dribbles", 0.6], ["acc_crosses", 0.4]] },
  { key: "buildup", label: "Opbygning", stats: [["pass_pct", 0.3], ["passes", 0.25], ["final_third_passes", 0.45]] },
  { key: "press", label: "Pres & generobring", stats: [["poss_won_att_third", 0.45], ["ball_recovery", 0.3], ["tackles", 0.25]] },
  { key: "defend", label: "Forsvar", stats: [["interceptions", 0.3], ["clearances", 0.25], ["aerial_won", 0.25], ["duels_won_pct", 0.2]] },
];

export interface StyleDim {
  key: string;
  label: string;
  score: number; // 0-100
}

/** Composite style dimensions from a player's percentile vector. A dimension is
 *  dropped if none of its component stats have a value (e.g. GK vs outfield). */
export function playerProfile(pct: Record<MetricKey, number | null>): StyleDim[] {
  const out: StyleDim[] = [];
  for (const d of DIMS) {
    let sum = 0;
    let w = 0;
    for (const [k, wt] of d.stats) {
      const p = pct[k];
      if (p == null) continue;
      sum += p * wt;
      w += wt;
    }
    if (w > 0) out.push({ key: d.key, label: d.label, score: Math.round(sum / w) });
  }
  return out;
}
