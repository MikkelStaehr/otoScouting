// Data-driven role detection. FM assigns roles from attributes (prescriptive);
// we assign the role a player ACTUALLY played (descriptive) from WHERE he operates
// — heatmap centroids incl. the attacking vs. defending shift — and WHAT he does
// there (league-adjusted percentiles). Output is a fuzzy best-fit, not a verdict:
// "this player behaves most like an X". Primary + secondary with a 0-100 score,
// each with a `why` — the top signals that drove the classification.

import type { SquadCentroid } from "./heatmap.ts";
import { METRIC_NAME } from "./metrics.ts";
import type { MetricKey } from "./types.ts";

export interface RoleFit {
  role: string;
  conf: number; // 0-100 match score
  why: string[]; // top contributing signals, human-readable
}
export interface RoleResult {
  bucket: string; // GK / CB / BACK / MID / WIDE / STRIKER / ?
  primary: RoleFit | null;
  secondary: RoleFit | null;
}

const clamp = (x: number) => Math.max(0, Math.min(100, x));
const span = (v: number, lo: number, hi: number) => clamp(((v - lo) / (hi - lo)) * 100);

// Positioning terms + their Danish phrases (hi = term high, lo = inverted/low).
type PosKey = "fs" | "inward" | "wide" | "deep" | "advanced" | "range" | "gkAdv" | "drop";
const POS_PHRASE: Record<PosKey, { hi: string; lo: string }> = {
  fs: { hi: "rykker højt op i angreb", lo: "bliver hjemme defensivt" },
  inward: { hi: "søger ind i banen", lo: "holder bredden" },
  wide: { hi: "bred position", lo: "central position" },
  deep: { hi: "dyb position", lo: "fremskudt position" },
  advanced: { hi: "fremskudt position", lo: "dyb position" },
  range: { hi: "dækker meget bane", lo: "" },
  gkAdv: { hi: "høj gns. position (kommer ud)", lo: "" },
  drop: { hi: "dropper dybt", lo: "" },
};

interface Sig {
  P: (k: string) => number;
  pos: Record<PosKey, number>;
}

// A term is a percentile metric or a positioning term, with a weight; `inv` flips it.
type Term =
  | { p: MetricKey; w: number; inv?: boolean }
  | { pos: PosKey; w: number; inv?: boolean };

const termValue = (t: Term, s: Sig): number => {
  const raw = "p" in t ? s.P(t.p) : s.pos[t.pos];
  return t.inv ? 100 - raw : raw;
};
const termLabel = (t: Term, s: Sig): string => {
  if ("p" in t) {
    const pctl = Math.round(s.P(t.p));
    return t.inv ? `lav ${METRIC_NAME[t.p]} (${pctl}p)` : `${METRIC_NAME[t.p]} (${pctl}p)`;
  }
  return t.inv ? POS_PHRASE[t.pos].lo : POS_PHRASE[t.pos].hi;
};

const ROLES: Record<string, { role: string; terms: Term[] }[]> = {
  GK: [
    { role: "Shot-Stopper", terms: [{ p: "gk_save_pct", w: 0.55 }, { p: "gk_goals_prevented", w: 0.45 }] },
    { role: "Ball-Playing GK", terms: [{ p: "pass_pct", w: 0.45 }, { p: "passes", w: 0.3 }, { p: "final_third_passes", w: 0.25 }] },
    { role: "Sweeper Keeper", terms: [{ pos: "gkAdv", w: 0.4 }, { p: "passes", w: 0.35 }, { p: "gk_goals_prevented", w: 0.25 }] },
    { role: "No-Nonsense GK", terms: [{ p: "pass_pct", w: 0.4, inv: true }, { p: "long_balls", w: 0.35 }, { p: "final_third_passes", w: 0.25, inv: true }] },
  ],
  // Central CB roles carry a centrality term (inverse-wide) so a wide, tackle-heavy
  // full-back doesn't read as a Stopper/CB — his wide centroid pulls him to BACK.
  // Wide CB is the exception (it's meant to sit wide in a back three).
  CB: [
    { role: "Ball-Playing CB", terms: [{ pos: "wide", w: 0.25, inv: true }, { p: "pass_pct", w: 0.35 }, { p: "final_third_passes", w: 0.25 }, { p: "passes", w: 0.15 }] },
    { role: "No-Nonsense CB", terms: [{ pos: "wide", w: 0.25, inv: true }, { p: "clearances", w: 0.35 }, { p: "aerial_won", w: 0.25 }, { p: "pass_pct", w: 0.15, inv: true }] },
    { role: "Stopper", terms: [{ pos: "wide", w: 0.3, inv: true }, { p: "tackles", w: 0.3 }, { p: "interceptions", w: 0.2 }, { p: "duels_won_pct", w: 0.2 }] },
    { role: "Wide CB", terms: [{ pos: "wide", w: 0.35 }, { p: "aerial_won", w: 0.5 }, { p: "clearances", w: 0.15 }] },
    { role: "Aggressive CB", terms: [{ pos: "wide", w: 0.2, inv: true }, { pos: "fs", w: 0.35 }, { p: "poss_won_att_third", w: 0.25 }, { p: "ball_recovery", w: 0.2 }] },
  ],
  BACK: [
    { role: "Attacking Wing-Back", terms: [{ pos: "fs", w: 0.35 }, { pos: "wide", w: 0.15 }, { p: "acc_crosses", w: 0.2 }, { p: "key_passes", w: 0.15 }, { p: "dribbles", w: 0.15 }] },
    { role: "Holding Full-Back", terms: [{ pos: "fs", w: 0.35, inv: true }, { pos: "wide", w: 0.15 }, { p: "tackles", w: 0.25 }, { p: "interceptions", w: 0.15 }, { p: "acc_crosses", w: 0.1, inv: true }] },
    { role: "Inverted Full-Back", terms: [{ pos: "inward", w: 0.5 }, { p: "pass_pct", w: 0.3 }, { p: "passes", w: 0.2 }] },
    { role: "Pressing Full-Back", terms: [{ p: "poss_won_att_third", w: 0.3 }, { p: "tackles", w: 0.25 }, { pos: "wide", w: 0.15 }, { p: "ball_recovery", w: 0.15 }, { pos: "fs", w: 0.15 }] },
  ],
  MID: [
    { role: "Anchor", terms: [{ pos: "deep", w: 0.3 }, { p: "tackles", w: 0.3 }, { p: "interceptions", w: 0.25 }, { p: "clearances", w: 0.15 }] },
    { role: "Deep-Lying Playmaker", terms: [{ p: "pass_pct", w: 0.35 }, { p: "passes", w: 0.3 }, { p: "final_third_passes", w: 0.2 }, { pos: "deep", w: 0.15 }] },
    { role: "Box-to-Box", terms: [{ pos: "range", w: 0.3 }, { p: "npg", w: 0.2 }, { p: "ball_recovery", w: 0.2 }, { p: "tackles", w: 0.15 }, { p: "dribbles", w: 0.15 }] },
    { role: "Advanced Playmaker", terms: [{ pos: "wide", w: 0.2, inv: true }, { pos: "advanced", w: 0.15 }, { p: "key_passes", w: 0.35 }, { p: "big_chances_created", w: 0.2 }, { p: "dribbles", w: 0.1 }] },
  ],
  WIDE: [
    { role: "Winger", terms: [{ pos: "wide", w: 0.3 }, { p: "acc_crosses", w: 0.35 }, { p: "dribbles", w: 0.35 }] },
    { role: "Inside Forward", terms: [{ pos: "wide", w: 0.15 }, { p: "xg", w: 0.3 }, { p: "shots", w: 0.25 }, { p: "npg", w: 0.3 }] },
    { role: "Wide Playmaker", terms: [{ p: "key_passes", w: 0.3 }, { p: "dribbles", w: 0.25 }, { p: "acc_crosses", w: 0.2 }, { p: "big_chances_created", w: 0.25 }] },
  ],
  STRIKER: [
    { role: "Poacher", terms: [{ p: "npg", w: 0.35 }, { p: "xg", w: 0.3 }, { p: "passes", w: 0.2, inv: true }, { p: "key_passes", w: 0.15, inv: true }] },
    { role: "Target Forward", terms: [{ p: "aerial_won", w: 0.45 }, { p: "shots", w: 0.2 }, { p: "dribbles", w: 0.15, inv: true }, { p: "npg", w: 0.2 }] },
    { role: "Deep-Lying Forward", terms: [{ pos: "drop", w: 0.3 }, { p: "key_passes", w: 0.3 }, { p: "passes", w: 0.2 }, { p: "big_chances_created", w: 0.2 }] },
    { role: "Complete Forward", terms: [{ p: "npg", w: 0.25 }, { p: "key_passes", w: 0.25 }, { p: "dribbles", w: 0.25 }, { p: "xa", w: 0.25 }] },
  ],
};

// Candidate buckets a player is scored across — NOT a hard bucket. A player is
// tried against every role in adjacent buckets (central + wide of his line), and
// the stats break the tie. So a "midfielder" whose heatmap is only mildly wide but
// whose numbers scream winger (dribbles/crosses) still lands as a Winger.
function candidateBuckets(posGroup: string, cx: number): string[] {
  if (posGroup === "GK") return ["GK"];
  if (posGroup === "DF") return ["CB", "BACK"];
  if (posGroup === "MF") return ["MID", "WIDE"];
  if (posGroup === "FW") return ["STRIKER", "WIDE"];
  // Unknown position → infer the neighbourhood from depth.
  if (cx < 0.42) return ["CB", "BACK"];
  if (cx > 0.6) return ["STRIKER", "WIDE"];
  return ["MID", "WIDE"];
}

// Top signals that drove the score — those the player is actually strong on, by
// contribution (weight × value). Falls back to top-2 if nothing stands out.
function explain(terms: Term[], s: Sig): string[] {
  const scored = terms
    .map((t) => ({ t, v: termValue(t, s), c: t.w * termValue(t, s) }))
    .sort((a, b) => b.c - a.c);
  const strong = scored.filter((x) => x.v >= 55);
  return (strong.length ? strong : scored).slice(0, 3).map((x) => termLabel(x.t, s));
}

export function classifyRole(
  posGroup: string,
  pct: Record<string, number | null>,
  c: SquadCentroid | null,
): RoleResult {
  if (!c) return { bucket: posGroup || "?", primary: null, secondary: null };
  const sig: Sig = {
    P: (k) => pct[k] ?? 50,
    pos: {
      fs: span(c.cxA - c.cxD, 0.02, 0.22),
      inward: span(Math.abs(c.cyD - 0.5) - Math.abs(c.cyA - 0.5), 0, 0.18),
      wide: span(Math.abs(c.cy - 0.5), 0.1, 0.32),
      deep: span(0.6 - c.cx, 0, 0.22),
      advanced: span(c.cx - 0.52, 0, 0.22),
      range: span(c.cxA - c.cxD, 0.05, 0.28),
      gkAdv: span(c.cx - 0.12, 0, 0.1),
      drop: span(0.72 - c.cx, 0, 0.15),
    },
  };
  const ranked = candidateBuckets(posGroup, c.cx)
    .flatMap((b) => (ROLES[b] ?? []).map((r) => ({ ...r, bucket: b })))
    .map((r) => ({
      role: r.role,
      bucket: r.bucket,
      conf: Math.round(clamp(r.terms.reduce((a, t) => a + t.w * termValue(t, sig), 0))),
      terms: r.terms,
    }))
    .sort((a, b) => b.conf - a.conf);
  const fit = (r: (typeof ranked)[number]): RoleFit => ({ role: r.role, conf: r.conf, why: explain(r.terms, sig) });
  return {
    bucket: ranked[0]?.bucket ?? posGroup ?? "?",
    primary: ranked[0] ? fit(ranked[0]) : null,
    secondary: ranked[1] && ranked[1].conf >= 50 ? fit(ranked[1]) : null,
  };
}
