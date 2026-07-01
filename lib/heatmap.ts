// Season action heatmap for a player (binned grid), read from player_heatmaps.

import { getDb } from "./db.ts";

export interface Heatmap {
  w: number;
  h: number;
  grid: number[]; // row-major, 0-1 intensity
  nPoints: number;
  matches: number | null;
}

/** Team composite heatmap: sum each outfield player's season grid weighted by
 *  minutes, then renormalise to 0-1. Shows where the team collectively operates.
 *  Keepers are excluded so their own-box blob doesn't dominate the shape. */
export function getTeamHeatmap(
  league: string,
  season: string,
  players: { id: number | null; minutes: number; isGk: boolean }[],
): Heatmap | null {
  const outfield = players.filter(
    (p): p is { id: number; minutes: number; isGk: boolean } => p.id != null && !p.isGk,
  );
  if (!outfield.length) return null;
  const ids = outfield.map((p) => p.id);
  const weight = new Map(outfield.map((p) => [p.id, Math.max(p.minutes, 1)]));
  try {
    const rows = getDb()
      .prepare(
        `SELECT player_id, grid_w, grid_h, grid FROM player_heatmaps
          WHERE league = ? AND season = ? AND player_id IN (${ids.map(() => "?").join(",")})`,
      )
      .all(league, season, ...ids) as {
      player_id: number;
      grid_w: number;
      grid_h: number;
      grid: string;
    }[];
    if (!rows.length) return null;

    let w = 0;
    let h = 0;
    let acc: number[] = [];
    for (const r of rows) {
      const grid = JSON.parse(r.grid) as number[];
      if (!acc.length) {
        w = r.grid_w;
        h = r.grid_h;
        acc = new Array(grid.length).fill(0);
      }
      if (grid.length !== acc.length) continue; // guard against mixed grid sizes
      const wt = weight.get(r.player_id) ?? 1;
      for (let i = 0; i < grid.length; i++) acc[i]! += grid[i]! * wt;
    }
    const max = Math.max(...acc, 1e-9);
    return {
      w,
      h,
      grid: acc.map((v) => v / max),
      nPoints: rows.length,
      matches: null,
    };
  } catch {
    return null; // table not built yet
  }
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
