// League-strength coefficients (config/leagues.json), read at request time so
// they can be tuned live. Used only for cross-league player ranking — a weaker
// league's per-90 output is discounted by its coefficient before the shared
// percentile pool is built. Missing/unknown leagues default to 1.0 (no change).

import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONFIG_PATH = join(process.cwd(), "config", "leagues.json");

export const ALL_LEAGUES = "ALL";

interface LeaguesConfig {
  leagues: Record<string, { strength?: number }>;
}

/** The full registry (all league keys, in order) — for the data-status view. */
export function loadLeagues(): Record<string, { strength?: number }> {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as LeaguesConfig;
    return raw.leagues ?? {};
  } catch {
    return {};
  }
}

/** league key -> strength coefficient (1.0 = strongest), from the registry. */
export function loadLeagueStrength(): Record<string, number> {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as LeaguesConfig;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw.leagues ?? {}))
      if (typeof v.strength === "number") out[k] = v.strength;
    return out;
  } catch {
    return {}; // no config → every league weighs 1.0
  }
}
