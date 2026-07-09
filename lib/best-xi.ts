// "Bedste XI" — pick the best player per formation slot from the cross-league
// pool. Slots come from the role classifier's buckets (GK/CB/BACK/MID/WIDE/
// STRIKER), ranking by strength-adjusted OUT (outfield) or a keeper score (GK).
// One engine; lenses (U21, bargain, nation, league) are just pool filters, and
// the season/form split is just which score we rank by. Server-only.

import type { EnrichedPlayer } from "./types.ts";
import { getCrossLeaguePlayers, getFullPoolPlayers } from "./players.ts";
import { getAllCentroids } from "./heatmap.ts";
import { classifyRole } from "./roles.ts";

// "all" = every league incl. the big-5 benchmark (a true best XI); "scouting" =
// development leagues only (a best-prospect XI, like the board).
export type Pool = "all" | "scouting";
const poolBoard = (pool: Pool) => (pool === "scouting" ? getCrossLeaguePlayers() : getFullPoolPlayers());

const pgOf = (pos: string | null): string => {
  const t = (pos ?? "").split(",")[0]?.trim() ?? "";
  return ["GK", "DF", "MF", "FW"].includes(t) ? t : "?";
};

export interface XIPlayer {
  key: string;
  player: string;
  team: string;
  league: string;
  nation: string | null;
  age: number | null;
  pos: string | null;
  minutes: number;
  marketValue: number | null;
  out: number | null; // rounded OUT (outfield) or keeper score
  role: string | null; // specific archetype (e.g. "Poacher")
  bucket: string; // GK / CB / BACK / MID / WIDE / STRIKER
  score: number; // season quality (OUT / keeper score)
  form: number; // Δ(xG+xA) since last snapshot (Δ goals-prevented for GK)
  hasForm: boolean; // whether a previous-snapshot delta exists at all
}

export interface Formation {
  key: string;
  label: string;
  slots: { bucket: string; count: number }[];
}

// 4-3-3 maps 1:1 to the role buckets. (Other shapes are a future toggle.)
export const F_433: Formation = {
  key: "433",
  label: "4-3-3",
  slots: [
    { bucket: "GK", count: 1 },
    { bucket: "CB", count: 2 },
    { bucket: "BACK", count: 2 },
    { bucket: "MID", count: 3 },
    { bucket: "WIDE", count: 2 },
    { bucket: "STRIKER", count: 1 },
  ],
};

export interface BestXI {
  formation: Formation;
  lineup: { bucket: string; players: XIPlayer[] }[];
  bench: XIPlayer[];
  poolSize: number; // qualified candidates considered
}

export interface XIOptions {
  minMinutes?: number;
  maxAge?: number | null; // e.g. 21 for a U21 XI
  nation?: string | null; // FBref nation code (e.g. "hr HRV")
  league?: string | null;
  bargain?: boolean; // rank by OUT per €m instead of raw OUT
  maxValue?: number | null; // euro cap
  metric?: "season" | "form"; // season quality (OUT) vs Δ-production since last snapshot
  pool?: Pool; // all leagues (incl. big-5) or scouting-only
}

// OUT is null for keepers, so rank them on goals-prevented percentile (then save%).
function gkScore(p: EnrichedPlayer): number {
  const pct = p.percentile as unknown as Record<string, number | null>;
  return pct.gk_goals_prevented ?? pct.gk_save_pct ?? 0;
}

function buildCandidates(minMinutes: number, pool: Pool): XIPlayer[] {
  const { players } = poolBoard(pool);
  const centroids = getAllCentroids();
  const out: XIPlayer[] = [];
  for (const p of players) {
    if (!p.qualified || p.minutes < minMinutes) continue;
    const sid = p.sofascore_id;
    const res = classifyRole(
      pgOf(p.pos),
      p.percentile as unknown as Record<string, number | null>,
      sid != null ? centroids.get(sid) ?? null : null,
    );
    const bucket = res.bucket;
    if (bucket === "?") continue;
    const isGk = bucket === "GK";
    const s = isGk ? gkScore(p) : p.outputScore ?? -1;
    if (s < 0) continue;
    const d = p.delta ?? {};
    const hasForm = d.xg != null || d.xa != null || d.gk_goals_prevented != null;
    const form = isGk ? d.gk_goals_prevented ?? 0 : (d.xg ?? 0) + (d.xa ?? 0);
    out.push({
      key: `${p.team}::${p.player}`,
      player: p.player,
      team: p.team,
      league: p.league,
      nation: p.nation,
      age: p.age,
      pos: p.pos,
      minutes: p.minutes,
      marketValue: p.market_value ?? null,
      out: Math.round(s),
      role: res.primary?.role ?? null,
      bucket,
      score: s,
      form,
      hasForm,
    });
  }
  return out;
}

/** Nations/leagues that actually have enough qualified players to field for — the
 *  options for the Nation/Liga lens dropdowns. Nations need ≥8 (a near-XI). */
export function xiFacets(
  pool: Pool = "all",
  minMinutes = 900,
): {
  nations: { code: string; count: number }[];
  leagues: { key: string; count: number }[];
} {
  const { players } = poolBoard(pool);
  const nat = new Map<string, number>();
  const lg = new Map<string, number>();
  for (const p of players) {
    if (!p.qualified || p.minutes < minMinutes) continue;
    if (p.nation) nat.set(p.nation, (nat.get(p.nation) ?? 0) + 1);
    lg.set(p.league, (lg.get(p.league) ?? 0) + 1);
  }
  return {
    nations: [...nat.entries()]
      .map(([code, count]) => ({ code, count }))
      .filter((n) => n.count >= 8)
      .sort((a, b) => b.count - a.count),
    leagues: [...lg.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function pickBestXI(opts: XIOptions = {}): BestXI {
  const minMinutes = opts.minMinutes ?? 900;
  let cands = buildCandidates(minMinutes, opts.pool ?? "all");
  if (opts.maxAge != null) cands = cands.filter((c) => c.age != null && c.age <= opts.maxAge!);
  if (opts.nation) cands = cands.filter((c) => c.nation === opts.nation);
  if (opts.league) cands = cands.filter((c) => c.league === opts.league);
  if (opts.maxValue != null) cands = cands.filter((c) => (c.marketValue ?? Infinity) <= opts.maxValue!);
  // Bargain = good players who are cheap, not the cheapest — keep a quality floor
  // (above-average output) so OUT/€m doesn't reward tiny-value obscurity.
  if (opts.bargain) cands = cands.filter((c) => c.score >= 60);
  // Form ranks by Δ-production, so only players that actually carry a delta.
  if (opts.metric === "form") cands = cands.filter((c) => c.hasForm);

  // Form → Δ(xG+xA); bargain → output-per-€m (missing value falls back to raw score
  // so it never wins outright); otherwise season OUT.
  const rankVal = (c: XIPlayer) =>
    opts.metric === "form"
      ? c.form
      : opts.bargain && c.marketValue && c.marketValue > 0
        ? c.score / (c.marketValue / 1e6)
        : c.score;

  const byBucket = new Map<string, XIPlayer[]>();
  for (const c of cands) {
    const arr = byBucket.get(c.bucket) ?? [];
    arr.push(c);
    byBucket.set(c.bucket, arr);
  }
  for (const arr of byBucket.values()) arr.sort((a, b) => rankVal(b) - rankVal(a));

  const lineup = F_433.slots.map(({ bucket, count }) => ({
    bucket,
    players: (byBucket.get(bucket) ?? []).slice(0, count),
  }));

  // Bench: the next-best in each bucket, so subs cover every line.
  const used = new Set(lineup.flatMap((l) => l.players.map((p) => p.key)));
  const bench: XIPlayer[] = [];
  for (const { bucket, count } of F_433.slots) {
    const next = (byBucket.get(bucket) ?? []).slice(count, count + 1)[0];
    if (next && !used.has(next.key)) bench.push(next);
  }

  return { formation: F_433, lineup, bench, poolSize: cands.length };
}
