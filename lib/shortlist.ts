// Compact player payload for the shortlist engine — every qualifying player with
// bio, output score, per-90 display values and percentiles for a curated metric
// set. The client does all filtering/ranking off this one cached dataset, so the
// shortlist is instant. Cached until the data version changes (like the dashboard).

import { statSync } from "node:fs";
import { join } from "node:path";
import { getCrossLeaguePlayers } from "./players.ts";
import { getAllCentroids } from "./heatmap.ts";
import { classifyRole } from "./roles.ts";
import { SHORTLIST_METRICS } from "./shortlist-metrics.ts";

const posGroup = (pos: string | null): string => {
  const t = (pos ?? "").split(",")[0]?.trim() ?? "";
  return ["GK", "DF", "MF", "FW"].includes(t) ? t : "?";
};

export interface ShortlistPlayer {
  key: string; // `${team}::${player}`
  sid: number | null; // sofascore_id (stable for watchlists)
  n: string;
  t: string;
  lg: string;
  age: number | null;
  min: number;
  mp: number;
  pos: string | null; // primary position
  pg: string; // position group GK/DF/MF/FW/?
  nat: string | null;
  isGk: boolean;
  out: number | null;
  role: string | null; // primary data-driven role
  role2: string | null; // secondary role (or null)
  roleConf: number | null;
  v: Record<string, number | null>; // per-90 / rate display values
  p: Record<string, number | null>; // percentiles (0-100)
}

export interface ShortlistData {
  players: ShortlistPlayer[];
  leagues: string[];
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

let cache: { version: string; data: ShortlistData } | null = null;

export function getShortlistData(): ShortlistData {
  const version = dataVersion();
  if (cache && cache.version === version) return cache.data;

  const { players } = getCrossLeaguePlayers();
  const centroids = getAllCentroids();
  const out: ShortlistPlayer[] = players
    .filter((p) => (p.minutes ?? 0) >= 450) // floor so tiny samples don't pollute
    .map((p) => {
      const per90 = p.per90 as unknown as Record<string, number | null>;
      const pct = p.percentile as unknown as Record<string, number | null>;
      const role = classifyRole(
        posGroup(p.pos),
        pct,
        p.sofascore_id != null ? centroids.get(p.sofascore_id) ?? null : null,
      );
      return {
        key: `${p.team}::${p.player}`,
        sid: p.sofascore_id ?? null,
        n: p.player,
        t: p.team,
        lg: p.league,
        age: p.age ?? null,
        min: p.minutes,
        mp: p.mp,
        pos: (p.pos ?? "").split(",")[0]?.trim() ?? null,
        pg: posGroup(p.pos),
        nat: p.nation ?? null,
        isGk: p.gk_saves != null,
        out: p.outputScore == null ? null : Math.round(p.outputScore),
        role: role.primary?.role ?? null,
        role2: role.secondary?.role ?? null,
        roleConf: role.primary?.conf ?? null,
        v: Object.fromEntries(SHORTLIST_METRICS.map((k) => [k, per90[k] ?? null])),
        p: Object.fromEntries(SHORTLIST_METRICS.map((k) => [k, pct[k] ?? null])),
      };
    });

  const leagues = [...new Set(out.map((p) => p.lg))].sort();
  const data: ShortlistData = { players: out, leagues };
  cache = { version, data };
  return data;
}
