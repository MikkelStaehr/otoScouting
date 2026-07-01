// Season action heatmap for a player (binned grid), read from player_heatmaps.

import { getDb } from "./db.ts";

export interface Heatmap {
  w: number;
  h: number;
  grid: number[]; // row-major, 0-1 intensity
  nPoints: number;
  matches: number | null;
}

export function getHeatmap(
  league: string,
  season: string,
  sofascoreId: number | null,
): Heatmap | null {
  if (sofascoreId == null) return null;
  try {
    const r = getDb()
      .prepare(
        `SELECT grid_w, grid_h, grid, n_points, matches FROM player_heatmaps
          WHERE league = ? AND season = ? AND player_id = ?`,
      )
      .get(league, season, sofascoreId) as
      | { grid_w: number; grid_h: number; grid: string; n_points: number; matches: number | null }
      | undefined;
    if (!r) return null;
    return {
      w: r.grid_w,
      h: r.grid_h,
      grid: JSON.parse(r.grid) as number[],
      nPoints: r.n_points,
      matches: r.matches,
    };
  } catch {
    return null; // table not built yet
  }
}
