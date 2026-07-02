// Team metric definitions — pure data (safe to import into client components).

import type { TeamMetricKey } from "./types.ts";

export interface TeamMetricDef {
  key: TeamMetricKey;
  label: string;
  /** Full, unabbreviated name (for the team report; the table uses `label`). */
  full: string;
  group: "off" | "def";
  /** A ratio already (possession, pass %, …) — not divided by matches. */
  rate: boolean;
  /** Lower is better — percentile is flipped so green = good. */
  invert: boolean;
}

export const TEAM_METRICS: TeamMetricDef[] = [
  { key: "goals", label: "Mål", full: "Mål", group: "off", rate: false, invert: false },
  { key: "xg", label: "xG", full: "Expected goals (xG)", group: "off", rate: false, invert: false },
  { key: "shots", label: "Skud", full: "Skud", group: "off", rate: false, invert: false },
  { key: "sot", label: "SoT", full: "Skud på mål", group: "off", rate: false, invert: false },
  { key: "big_chances", label: "Big ch.", full: "Store chancer", group: "off", rate: false, invert: false },
  { key: "possession", label: "Bold%", full: "Boldbesiddelse", group: "off", rate: true, invert: false },
  { key: "pass_pct", label: "Pass%", full: "Afleveringspræcision", group: "off", rate: true, invert: false },
  { key: "goals_conceded", label: "Mål imod", full: "Mål imod", group: "def", rate: false, invert: true },
  { key: "shots_against", label: "Skud imod", full: "Skud imod", group: "def", rate: false, invert: true },
  { key: "big_chances_against", label: "Big ch. imod", full: "Store chancer imod", group: "def", rate: false, invert: true },
  { key: "clean_sheets", label: "Clean sheets", full: "Clean sheets", group: "def", rate: false, invert: false },
  { key: "interceptions", label: "Int", full: "Erobringer", group: "def", rate: false, invert: false },
  { key: "tackles", label: "Tklr", full: "Tacklinger", group: "def", rate: false, invert: false },
  { key: "duels_won_pct", label: "Dueller%", full: "Vundne dueller", group: "def", rate: true, invert: false },
  { key: "aerials_won_pct", label: "Luft%", full: "Vundne luftdueller", group: "def", rate: true, invert: false },
];
