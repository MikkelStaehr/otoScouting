// Flat "raw database" payload — every player's raw season values across all the
// stored columns, for the Raw Database view (dense table + CSV export). Cached on
// the data version like the other read layers.

import { statSync } from "node:fs";
import { join } from "node:path";
import { getCrossLeaguePlayers } from "./players.ts";
import { getAllCentroids } from "./heatmap.ts";
import { classifyRole } from "./roles.ts";

const pgOf = (pos: string | null): string => {
  const t = (pos ?? "").split(",")[0]?.trim() ?? "";
  return ["GK", "DF", "MF", "FW"].includes(t) ? t : "?";
};

export interface RawColumn {
  key: string;
  label: string;
  num: boolean;
}

// Ordered columns: identity, playing time, then raw season totals + rates.
const COLS: RawColumn[] = [
  { key: "player", label: "Spiller", num: false },
  { key: "team", label: "Hold", num: false },
  { key: "league", label: "Liga", num: false },
  { key: "season_label", label: "Sæson", num: false },
  { key: "pos", label: "Pos", num: false },
  { key: "role", label: "Rolle", num: false },
  { key: "nation", label: "Nat", num: false },
  { key: "age", label: "Alder", num: true },
  { key: "mp", label: "Kampe", num: true },
  { key: "minutes", label: "Min", num: true },
  { key: "out", label: "OUT", num: true },
  { key: "goals", label: "Mål", num: true },
  { key: "assists", label: "Assist", num: true },
  { key: "npg", label: "npG", num: true },
  { key: "xg", label: "xG", num: true },
  { key: "xa", label: "xA", num: true },
  { key: "shots", label: "Skud", num: true },
  { key: "sot", label: "SoT", num: true },
  { key: "key_passes", label: "KP", num: true },
  { key: "big_chances_created", label: "BCC", num: true },
  { key: "dribbles", label: "Drb", num: true },
  { key: "acc_crosses", label: "aCrs", num: true },
  { key: "tackles", label: "Tkl", num: true },
  { key: "interceptions", label: "Int", num: true },
  { key: "clearances", label: "Clr", num: true },
  { key: "blocks", label: "Blk", num: true },
  { key: "ball_recovery", label: "Rec", num: true },
  { key: "aerial_won", label: "Aer", num: true },
  { key: "duels_won_pct", label: "Duel%", num: true },
  { key: "pass_pct", label: "Pass%", num: true },
  { key: "passes", label: "Pass", num: true },
  { key: "long_balls", label: "LB", num: true },
  { key: "final_third_passes", label: "F3P", num: true },
  { key: "gk_saves", label: "Sv", num: true },
  { key: "gk_clean_sheets", label: "CS", num: true },
  { key: "gk_save_pct", label: "Sv%", num: true },
  { key: "gk_goals_prevented", label: "GP", num: true },
];

export interface RawData {
  cols: RawColumn[];
  rows: (string | number | null)[][];
  keys: string[]; // `${team}::${player}` per row (for opening the player modal)
}

function dataVersion(): string {
  return ["scouting.db", "config/model.json", "config/leagues.json"]
    .map((f) => {
      try {
        return statSync(join(process.cwd(), f)).mtimeMs;
      } catch {
        return 0;
      }
    })
    .join("-");
}

let cache: { version: string; data: RawData } | null = null;

export function getRawData(): RawData {
  const version = dataVersion();
  if (cache && cache.version === version) return cache.data;

  const { players } = getCrossLeaguePlayers();
  const centroids = getAllCentroids();
  const keys: string[] = [];
  const rows = players.map((p) => {
    const rec = p as unknown as Record<string, number | string | null>;
    keys.push(`${p.team}::${p.player}`);
    const role = classifyRole(
      pgOf(p.pos),
      p.percentile as unknown as Record<string, number | null>,
      p.sofascore_id != null ? centroids.get(p.sofascore_id) ?? null : null,
    ).primary?.role ?? null;
    return COLS.map((c) => {
      if (c.key === "out") return p.outputScore == null ? null : Math.round(p.outputScore);
      if (c.key === "role") return role;
      const v = rec[c.key];
      return v === undefined ? null : v;
    });
  });

  const data: RawData = { cols: COLS, rows, keys };
  cache = { version, data };
  return data;
}
