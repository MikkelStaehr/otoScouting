// Player detail + statistical similarity. Each player is a vector of percentile
// values (already 0-100 and league-strength adjusted), so the distance between
// two vectors is how alike their profiles are. Similarity = 100 − RMSE over the
// metrics both players have. Candidates are the same class (outfield/GK) and, for
// outfielders, the same primary position — a CB is matched to CBs, not wingers.

import { getCrossLeaguePlayers } from "./players.ts";
import { loadModelConfig } from "./model.ts";
import { getHeatmap, type Heatmap } from "./heatmap.ts";
import { METRIC_NAME, GROUP_LABEL } from "./metrics.ts";
import type { EnrichedPlayer, GroupKey, MetricKey } from "./types.ts";

const SIM_OUTFIELD: MetricKey[] = [
  "npg", "xg", "shots", "sot", "key_passes", "big_chances_created", "xa",
  "dribbles", "acc_crosses", "tackles", "interceptions", "clearances", "blocks",
  "ball_recovery", "aerial_won", "duels_won_pct", "pass_pct", "long_balls",
  "final_third_passes",
];
const SIM_GK: MetricKey[] = [
  "gk_goals_prevented", "gk_save_pct", "gk_clean_sheets", "gk_saves", "gk_ga", "gk_sota",
];

const posGroup = (pos: string | null): string => {
  const t = (pos ?? "").split(",")[0]?.trim() ?? "";
  return ["GK", "DF", "MF", "FW"].includes(t) ? t : "?";
};

export interface SimStat {
  key: string;
  label: string;
  value: number | null;
  pct: number | null;
}
export interface SimGroup {
  label: string;
  stats: SimStat[];
}
export interface SimilarPlayer {
  key: string;
  player: string;
  team: string;
  league: string;
  age: number | null;
  pos: string | null;
  sim: number;
}
export interface PlayerDetail {
  key: string;
  sid: number | null; // sofascore_id (stable id for watchlists)
  player: string;
  team: string;
  league: string;
  age: number | null;
  pos: string | null;
  posGroup: string;
  nation: string | null;
  minutes: number;
  out: number | null;
  heatmap: Heatmap | null;
  groups: SimGroup[];
  similar: SimilarPlayer[];
}

export function getPlayerDetail(key: string): PlayerDetail | null {
  const { players } = getCrossLeaguePlayers();
  const target = players.find((p) => `${p.team}::${p.player}` === key);
  if (!target) return null;

  const isGk = target.gk_saves != null;
  const grp = posGroup(target.pos);
  const simKeys = isGk ? SIM_GK : SIM_OUTFIELD;
  const vec = (p: EnrichedPlayer) => simKeys.map((k) => p.percentile[k]);
  const tv = vec(target);

  const similar: SimilarPlayer[] = players
    .filter(
      (p) =>
        `${p.team}::${p.player}` !== key &&
        (p.gk_saves != null) === isGk &&
        (p.minutes ?? 0) >= 540 &&
        (isGk || posGroup(p.pos) === grp),
    )
    .map((p) => {
      const pv = vec(p);
      let sum = 0;
      let n = 0;
      for (let i = 0; i < simKeys.length; i++) {
        const a = tv[i];
        const b = pv[i];
        if (a != null && b != null) {
          sum += (a - b) ** 2;
          n++;
        }
      }
      if (n < Math.min(6, simKeys.length)) return null;
      return { p, sim: Math.max(0, Math.round(100 - Math.sqrt(sum / n))) };
    })
    .filter((x): x is { p: EnrichedPlayer; sim: number } => x != null)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 8)
    .map(({ p, sim }) => ({
      key: `${p.team}::${p.player}`,
      player: p.player,
      team: p.team,
      league: p.league,
      age: p.age ?? null,
      pos: p.pos,
      sim,
    }));

  const config = loadModelConfig();
  const displayGroups: GroupKey[] = isGk
    ? ["goalkeeping", "buildup"] // buildup shows sweeper / ball-playing profile
    : ["offensive", "expected", "creation", "efficiency", "defensive", "buildup"];
  const groups: SimGroup[] = displayGroups
    .filter((g) => config.groups[g]?.length)
    .map((g) => ({
      label: GROUP_LABEL[g],
      stats: config.groups[g].map((k) => ({
        key: k,
        label: METRIC_NAME[k],
        value: target.per90[k],
        pct: target.percentile[k],
      })),
    }));

  return {
    key,
    sid: target.sofascore_id ?? null,
    player: target.player,
    team: target.team,
    league: target.league,
    age: target.age ?? null,
    pos: target.pos,
    posGroup: grp,
    nation: target.nation,
    minutes: target.minutes,
    out: target.outputScore == null ? null : Math.round(target.outputScore),
    heatmap: getHeatmap(target.league, target.season, target.sofascore_id),
    groups,
    similar,
  };
}
