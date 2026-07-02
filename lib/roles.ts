// Data-driven role detection. FM assigns roles from attributes (prescriptive);
// we assign the role a player ACTUALLY played (descriptive) from WHERE he operates
// — heatmap centroids incl. the attacking vs. defending shift — and WHAT he does
// there (league-adjusted percentiles). Output is a fuzzy best-fit, not a verdict:
// "this player behaves most like an X". Primary + secondary with a 0-100 score.

import type { SquadCentroid } from "./heatmap.ts";

export interface RoleFit {
  role: string;
  conf: number; // 0-100 match score
}
export interface RoleResult {
  bucket: string; // GK / CB / BACK / MID / WIDE / STRIKER / ?
  primary: RoleFit | null;
  secondary: RoleFit | null;
}

const clamp = (x: number) => Math.max(0, Math.min(100, x));
// Map a raw positional delta into 0-100 over an expected span.
const span = (v: number, lo: number, hi: number) => clamp(((v - lo) / (hi - lo)) * 100);

// The signals a role scorer reads: percentile accessor P + positioning terms.
interface Sig {
  P: (k: string) => number; // percentile 0-100 (missing → 50, neutral)
  cx: number; cy: number; cxA: number; cyA: number;
  wide: number; // how wide (0-100)
  fs: number; // forward shift att vs def (0-100) — holding ↔ wing-back
  inward: number; // moves toward centre in possession (0-100) — inverted
  range: number; // depth coverage att-def (0-100) — box-to-box
  deep: number; // how deep for a midfielder (0-100)
  advanced: number; // how advanced (0-100)
  gkAdv: number; // keeper sweeping high (0-100)
}

type Scorer = (s: Sig) => number;

const ROLES: Record<string, { role: string; score: Scorer }[]> = {
  GK: [
    { role: "Shot-Stopper", score: (s) => 0.55 * s.P("gk_save_pct") + 0.45 * s.P("gk_goals_prevented") },
    { role: "Ball-Playing GK", score: (s) => 0.45 * s.P("pass_pct") + 0.3 * s.P("passes") + 0.25 * s.P("final_third_passes") },
    { role: "Sweeper Keeper", score: (s) => 0.4 * s.gkAdv + 0.35 * s.P("passes") + 0.25 * s.P("gk_goals_prevented") },
    { role: "No-Nonsense GK", score: (s) => 0.4 * (100 - s.P("pass_pct")) + 0.35 * s.P("long_balls") + 0.25 * (100 - s.P("final_third_passes")) },
  ],
  CB: [
    { role: "Ball-Playing CB", score: (s) => 0.4 * s.P("pass_pct") + 0.3 * s.P("final_third_passes") + 0.2 * s.P("passes") + 0.1 * s.P("long_ball_pct") },
    { role: "No-Nonsense CB", score: (s) => 0.4 * s.P("clearances") + 0.3 * s.P("aerial_won") + 0.3 * (100 - s.P("pass_pct")) },
    { role: "Stopper", score: (s) => 0.35 * s.P("tackles") + 0.25 * s.P("interceptions") + 0.2 * s.P("duels_won_pct") + 0.2 * s.fs },
    { role: "Wide CB", score: (s) => 0.6 * s.wide + 0.4 * s.P("aerial_won") },
    { role: "Aggressive CB", score: (s) => 0.4 * s.fs + 0.3 * s.P("poss_won_att_third") + 0.3 * s.P("ball_recovery") },
  ],
  BACK: [
    { role: "Attacking Wing-Back", score: (s) => 0.4 * s.fs + 0.25 * s.P("acc_crosses") + 0.2 * s.P("key_passes") + 0.15 * s.P("dribbles") },
    { role: "Holding Full-Back", score: (s) => 0.4 * (100 - s.fs) + 0.25 * s.P("tackles") + 0.2 * s.P("interceptions") + 0.15 * (100 - s.P("acc_crosses")) },
    { role: "Inverted Full-Back", score: (s) => 0.5 * s.inward + 0.3 * s.P("pass_pct") + 0.2 * s.P("passes") },
    { role: "Pressing Full-Back", score: (s) => 0.35 * s.P("poss_won_att_third") + 0.3 * s.P("tackles") + 0.2 * s.P("ball_recovery") + 0.15 * s.fs },
  ],
  MID: [
    { role: "Anchor", score: (s) => 0.3 * s.deep + 0.3 * s.P("tackles") + 0.25 * s.P("interceptions") + 0.15 * s.P("clearances") },
    { role: "Deep-Lying Playmaker", score: (s) => 0.35 * s.P("pass_pct") + 0.3 * s.P("passes") + 0.2 * s.P("final_third_passes") + 0.15 * s.deep },
    { role: "Box-to-Box", score: (s) => 0.3 * s.range + 0.2 * s.P("npg") + 0.2 * s.P("ball_recovery") + 0.15 * s.P("tackles") + 0.15 * s.P("dribbles") },
    { role: "Advanced Playmaker", score: (s) => 0.25 * s.advanced + 0.35 * s.P("key_passes") + 0.25 * s.P("big_chances_created") + 0.15 * s.P("dribbles") },
  ],
  WIDE: [
    { role: "Winger", score: (s) => 0.3 * s.wide + 0.35 * s.P("acc_crosses") + 0.35 * s.P("dribbles") },
    // Lateral inversion is weak in our depth-based phase proxy, so lean on the
    // essence: a wide player who shoots and scores (vs. crosses/creates).
    { role: "Inside Forward", score: (s) => 0.15 * s.inward + 0.3 * s.P("xg") + 0.25 * s.P("shots") + 0.3 * s.P("npg") },
    { role: "Wide Playmaker", score: (s) => 0.4 * s.P("key_passes") + 0.3 * s.P("big_chances_created") + 0.3 * s.P("dribbles") },
  ],
  STRIKER: [
    { role: "Poacher", score: (s) => 0.35 * s.P("npg") + 0.3 * s.P("xg") + 0.2 * (100 - s.P("passes")) + 0.15 * (100 - s.P("key_passes")) },
    { role: "Target Forward", score: (s) => 0.45 * s.P("aerial_won") + 0.2 * s.P("shots") + 0.15 * (100 - s.P("dribbles")) + 0.2 * s.P("npg") },
    { role: "Deep-Lying Forward", score: (s) => 0.3 * span(0.72 - s.cx, 0, 0.15) + 0.3 * s.P("key_passes") + 0.2 * s.P("passes") + 0.2 * s.P("big_chances_created") },
    { role: "Complete Forward", score: (s) => 0.25 * s.P("npg") + 0.25 * s.P("key_passes") + 0.25 * s.P("dribbles") + 0.25 * s.P("xa") },
  ],
};

function bucketOf(posGroup: string, cx: number, cy: number): string {
  if (posGroup === "GK") return "GK";
  const wide = Math.abs(cy - 0.5) > 0.15;
  if (posGroup === "DF") return wide ? "BACK" : "CB";
  if (posGroup === "FW") return wide ? "WIDE" : "STRIKER";
  if (posGroup === "MF") return wide ? "WIDE" : "MID";
  // Unknown position → infer from depth.
  if (cx < 0.42) return wide ? "BACK" : "CB";
  if (cx > 0.62) return wide ? "WIDE" : "STRIKER";
  return wide ? "WIDE" : "MID";
}

/** Classify a player's role from his position group, percentiles and centroid.
 *  Returns null primary if there's no heatmap centroid (no positional signal). */
export function classifyRole(
  posGroup: string,
  pct: Record<string, number | null>,
  c: SquadCentroid | null,
): RoleResult {
  if (!c) return { bucket: posGroup || "?", primary: null, secondary: null };
  const P = (k: string) => pct[k] ?? 50;
  const sig: Sig = {
    P,
    cx: c.cx, cy: c.cy, cxA: c.cxA, cyA: c.cyA,
    wide: span(Math.abs(c.cy - 0.5), 0.1, 0.32),
    fs: span(c.cxA - c.cxD, 0.02, 0.22),
    inward: span(Math.abs(c.cyD - 0.5) - Math.abs(c.cyA - 0.5), 0, 0.18),
    range: span(c.cxA - c.cxD, 0.05, 0.28),
    deep: span(0.6 - c.cx, 0, 0.22),
    advanced: span(c.cx - 0.52, 0, 0.22),
    gkAdv: span(c.cx - 0.12, 0, 0.1),
  };
  const bucket = bucketOf(posGroup, c.cx, c.cy);
  const ranked = (ROLES[bucket] ?? [])
    .map((r) => ({ role: r.role, conf: Math.round(clamp(r.score(sig))) }))
    .sort((a, b) => b.conf - a.conf);
  return {
    bucket,
    primary: ranked[0] ?? null,
    secondary: ranked[1] && ranked[1].conf >= 50 ? ranked[1] : null,
  };
}
