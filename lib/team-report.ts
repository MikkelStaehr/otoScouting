// Full team report: the season performance profile (every team metric with its
// value, percentile and league rank), auto-derived strengths/weaknesses, plus the
// defensive-zone weakness + fit engine. Composes getTeams (per-league ranking)
// with getTeamWeakness (the recruitment layer) so the team modal reads like the
// player modal — a real scouting dossier, not just "softest player".

import { getTeams, getTeamLeagueSeasons } from "./teams.ts";
import { getTeamWeakness, type ZoneCover } from "./weakness.ts";
import { normTeam } from "./merge.ts";
import { TEAM_METRICS } from "./team-metrics.ts";
import type { EnrichedTeam } from "./types.ts";

export interface TeamMetricReport {
  key: string;
  label: string;
  group: "off" | "def";
  value: number | null;
  pct: number | null; // percentile within the league (invert applied → green = good)
  rank: number | null; // 1 = best in league on this metric
  of: number; // teams with a value on this metric
  rate: boolean; // true → a percentage/ratio (shown with %), else per-match count
}

export interface TeamReport {
  team: string;
  league: string;
  season_label: string;
  matches: number | null;
  rating: number | null;
  ratingRank: number | null;
  teamsInLeague: number;
  metrics: TeamMetricReport[];
  strengths: TeamMetricReport[]; // top percentile metrics
  weaknesses: TeamMetricReport[]; // bottom percentile metrics
  // defensive-zone weakness + recruitment fits (existing engine)
  zones: ZoneCover[];
  goalsAgainst: number | null;
  bigChancesAgainst: number | null;
}

export function getTeamReport(league: string, team: string): TeamReport | null {
  const weakness = getTeamWeakness(league, team);
  if (!weakness) return null;

  // Find the league-season this team plays in (latest first) and its siblings,
  // so we can rank each metric within the league.
  const nt = normTeam(team);
  const seasons = getTeamLeagueSeasons().filter((s) => s.league === league);
  let siblings: EnrichedTeam[] = [];
  let me: EnrichedTeam | undefined;
  let seasonLabel = "";
  for (const s of seasons) {
    const ts = getTeams(league, s.season);
    const found = ts.find((t) => normTeam(t.team) === nt);
    if (found) {
      siblings = ts;
      me = found;
      seasonLabel = s.season_label;
      break;
    }
  }

  const metrics: TeamMetricReport[] = [];
  let ratingRank: number | null = null;

  if (me) {
    // Rating rank within the league.
    const myRating = me.avg_rating;
    if (myRating != null) {
      ratingRank =
        1 + siblings.filter((t) => (t.avg_rating ?? -Infinity) > myRating).length;
    }

    for (const m of TEAM_METRICS) {
      const myVal = me.value[m.key];
      const withVal = siblings.filter((t) => t.value[m.key] != null);
      let rank: number | null = null;
      if (myVal != null) {
        // Better = higher, unless the metric is inverted (goals conceded, etc.).
        const better = withVal.filter((t) => {
          const tv = t.value[m.key]!;
          return m.invert ? tv < myVal : tv > myVal;
        }).length;
        rank = better + 1;
      }
      metrics.push({
        key: m.key,
        label: m.label,
        group: m.group,
        value: myVal ?? null,
        pct: me.percentile[m.key] ?? null,
        rank,
        of: withVal.length,
        rate: m.rate,
      });
    }
  }

  // Auto-derive strengths (top percentiles) and weaknesses (bottom). Skip metrics
  // with no percentile. A 12-team league → pct 65+ is clearly top-third.
  const ranked = metrics
    .filter((m) => m.pct != null)
    .sort((a, b) => b.pct! - a.pct!);
  const strengths = ranked.filter((m) => m.pct! >= 65).slice(0, 4);
  const weaknesses = [...ranked]
    .reverse()
    .filter((m) => m.pct! <= 35)
    .slice(0, 4);

  return {
    team: weakness.team,
    league,
    season_label: seasonLabel,
    matches: me?.matches ?? null,
    rating: me?.avg_rating ?? null,
    ratingRank,
    teamsInLeague: siblings.length,
    metrics,
    strengths,
    weaknesses,
    zones: weakness.zones,
    goalsAgainst: weakness.goalsAgainst,
    bigChancesAgainst: weakness.bigChancesAgainst,
  };
}
