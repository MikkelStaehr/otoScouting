// Positional threat from a player's season heatmap — an xT-style spatial value layer.
// We can't compute true action-level xT/VAEP (no pass event streams), but our 12x8
// season heatmaps line up with the standard Expected-Threat grid resolution, so we
// weight each cell's activity by its threat: how dangerous the zones a player operates
// in are. It's a *positioning* signal (territory), not action value — but it splits
// deeper roles the FBref position misses (attacking full-back vs deep CB, advanced
// playmaker vs anchor). Validated: mean PT FW > MF > DF > GK, top = Hakimi/Salah-types.

import { getDb } from "./db.ts";

// Threat by pitch column (0 = own goal, 11 = opponent goal), rising toward goal and
// lifted centrally near the box. Grid index i = row*12 + col (matches the heatmap).
// Approximates Karun Singh's published xT surface at our resolution.
const COL_BASE = [0.006, 0.008, 0.011, 0.016, 0.022, 0.03, 0.042, 0.06, 0.088, 0.13, 0.19, 0.25];
export const XT_GRID: number[] = (() => {
  const g: number[] = new Array(96).fill(0);
  for (let row = 0; row < 8; row++) {
    const cent = 1 - Math.abs(row - 3.5) / 3.5; // 0 at the touchlines, 1 centrally
    for (let col = 0; col < 12; col++) g[row * 12 + col] = COL_BASE[col]! * (1 + 0.6 * cent * (col / 11));
  }
  return g;
})();

export interface SpatialProfile {
  pt: number; // xT-weighted activity (positional threat)
  ownThird: number; // activity share in the defensive third (cols 0-3)
  attThird: number; // activity share in the attacking third (cols 8-11)
}

export function spatialProfile(grid: number[]): SpatialProfile | null {
  if (grid.length !== 96) return null;
  const s = grid.reduce((a, b) => a + b, 0) || 1;
  let pt = 0;
  let own = 0;
  let att = 0;
  for (let i = 0; i < 96; i++) {
    const v = grid[i]! / s; // activity share for this cell
    pt += v * XT_GRID[i]!;
    const col = i % 12;
    if (col < 4) own += v;
    else if (col >= 8) att += v;
  }
  return { pt, ownThird: own, attThird: att };
}

let cache: { version: number; map: Map<number, SpatialProfile> } | null = null;

/** Spatial profile for every player with a heatmap, keyed by Sofascore id. Cached on
 *  the heatmap row count (same as getAllCentroids). */
export function getAllThreat(): Map<number, SpatialProfile> {
  const db = getDb();
  let version = 0;
  try {
    version = (db.prepare("SELECT COUNT(*) AS n FROM player_heatmaps").get() as { n: number }).n;
  } catch {
    return new Map();
  }
  if (cache && cache.version === version) return cache.map;
  const map = new Map<number, SpatialProfile>();
  const rows = db.prepare("SELECT player_id, grid FROM player_heatmaps").all() as {
    player_id: number;
    grid: string;
  }[];
  for (const r of rows) {
    const p = spatialProfile(JSON.parse(r.grid) as number[]);
    if (p) map.set(r.player_id, p);
  }
  cache = { version, map };
  return map;
}
