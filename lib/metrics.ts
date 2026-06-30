// Shared display labels for metrics + groups (used by the table and the
// comparison overlay). Pure data — safe to import anywhere.

import type { GroupKey, MetricKey } from "./types.ts";

export const METRIC_LABEL: Record<MetricKey, string> = {
  goals: "G",
  assists: "A",
  npg: "npG",
  shots: "Sh",
  sot: "SoT",
  interceptions: "Int",
  tackles_won: "TklW",
  fouled: "Fld",
  crosses: "Crs",
  fouls: "Fls",
  gk_saves: "Sv",
  gk_clean_sheets: "CS",
  gk_save_pct: "Sv%",
  gk_ga: "GA",
  gk_sota: "SoTA",
  gk_pk_saved: "PKsv",
  conv_pct: "Conv%",
  sot_pct: "SoT%",
  g_per_sot: "G/SoT",
  xg: "xG",
  xa: "xA",
  g_minus_xg: "G−xG",
  gk_goals_prevented: "GP",
};

// Danish "oversættelse" shown as hover tooltips.
export const METRIC_DESC: Record<MetricKey, string> = {
  goals: "Mål",
  assists: "Assists",
  npg: "Mål uden straffespark (non-penalty goals)",
  shots: "Skud",
  sot: "Skud på mål (shots on target)",
  interceptions: "Erobringer / interceptions",
  tackles_won: "Vundne tacklinger",
  fouled: "Frispark vundet (blev lagt ned)",
  crosses: "Indlæg",
  fouls: "Begåede frispark",
  gk_saves: "Redninger",
  gk_clean_sheets: "Clean sheets (kampe uden mål imod)",
  gk_save_pct: "Redningsprocent (højere er bedre)",
  gk_ga: "Mål imod (lavere er bedre)",
  gk_sota: "Skud på mål imod (lavere er bedre)",
  gk_pk_saved: "Reddede straffespark",
  conv_pct: "Konvertering: mål per skud i % (min. 20 skud)",
  sot_pct: "Skud-præcision: skud på mål per skud i % (min. 20 skud)",
  g_per_sot: "Mål per skud på mål (min. 8 SoT)",
  xg: "Expected goals (Sofascore) — forventede mål ud fra chancekvalitet",
  xa: "Expected assists (Sofascore) — forventede assists",
  g_minus_xg: "Mål minus xG: afslutning over/under forventning (min. 20 skud)",
  gk_goals_prevented: "Goals prevented: reddede mål over forventning (post-shot xG − mål imod)",
};

// Full, readable names (for the filter picker etc.). Abbreviations live in
// METRIC_LABEL; show them together as "Full name (ABBR)".
export const METRIC_NAME: Record<MetricKey, string> = {
  goals: "Mål",
  assists: "Assists",
  npg: "Mål uden straffe",
  shots: "Skud",
  sot: "Skud på mål",
  interceptions: "Erobringer",
  tackles_won: "Vundne tacklinger",
  fouled: "Frispark vundet",
  crosses: "Indlæg",
  fouls: "Begåede frispark",
  gk_saves: "Redninger",
  gk_clean_sheets: "Clean sheets",
  gk_save_pct: "Redningsprocent",
  gk_ga: "Mål imod",
  gk_sota: "Skud på mål imod",
  gk_pk_saved: "Reddede straffe",
  conv_pct: "Konvertering",
  sot_pct: "Skud-præcision",
  g_per_sot: "Mål per skud på mål",
  xg: "Expected goals",
  xa: "Expected assists",
  g_minus_xg: "Mål minus xG",
  gk_goals_prevented: "Goals prevented",
};

export const GROUP_LABEL: Record<GroupKey, string> = {
  offensive: "Offensive",
  expected: "Expected (xG)",
  efficiency: "Efficiency",
  defensive: "Defensive",
  goalkeeping: "Goalkeeping",
};
