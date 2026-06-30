// Team metric definitions — pure data (safe to import into client components).

import type { TeamMetricKey } from "./types.ts";

export interface TeamMetricDef {
  key: TeamMetricKey;
  label: string;
  group: "off" | "def";
  /** A ratio already (possession, pass %, …) — not divided by matches. */
  rate: boolean;
  /** Lower is better — percentile is flipped so green = good. */
  invert: boolean;
}

export const TEAM_METRICS: TeamMetricDef[] = [
  { key: "goals", label: "Mål", group: "off", rate: false, invert: false },
  { key: "xg", label: "xG", group: "off", rate: false, invert: false },
  { key: "shots", label: "Skud", group: "off", rate: false, invert: false },
  { key: "sot", label: "SoT", group: "off", rate: false, invert: false },
  { key: "big_chances", label: "Big ch.", group: "off", rate: false, invert: false },
  { key: "possession", label: "Bold%", group: "off", rate: true, invert: false },
  { key: "pass_pct", label: "Pass%", group: "off", rate: true, invert: false },
  { key: "goals_conceded", label: "Mål imod", group: "def", rate: false, invert: true },
  { key: "shots_against", label: "Skud imod", group: "def", rate: false, invert: true },
  { key: "big_chances_against", label: "Big ch. imod", group: "def", rate: false, invert: true },
  { key: "clean_sheets", label: "Clean sheets", group: "def", rate: false, invert: false },
  { key: "interceptions", label: "Int", group: "def", rate: false, invert: false },
  { key: "tackles", label: "Tklr", group: "def", rate: false, invert: false },
  { key: "duels_won_pct", label: "Dueller%", group: "def", rate: true, invert: false },
  { key: "aerials_won_pct", label: "Luft%", group: "def", rate: true, invert: false },
];
