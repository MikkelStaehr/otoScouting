// Full team report: the season performance profile (every team metric with its
// value, percentile and league rank), auto-derived strengths/weaknesses, plus the
// defensive-zone weakness + fit engine. Composes getTeams (per-league ranking)
// with getTeamWeakness (the recruitment layer) so the team modal reads like the
// player modal — a real scouting dossier, not just "softest player".

import { getTeams, getTeamLeagueSeasons } from "./teams.ts";
import { getTeamWeakness, type ZoneCover } from "./weakness.ts";
import { getCrossLeaguePlayers } from "./players.ts";
import { getShortlistData } from "./shortlist.ts";
import { ROLE_BUCKET, BUCKET_ORDER } from "./role-meta.ts";
import { getTeamHeatmap, getSquadCentroids, type Heatmap } from "./heatmap.ts";
import { getTeamFormations, type Formation } from "./formations.ts";
import { classifyRole } from "./roles.ts";
import { classifyTeamStyle, type TeamStyle } from "./team-style.ts";
import { normTeam } from "./merge.ts";
import { TEAM_METRICS } from "./team-metrics.ts";
import type { EnrichedTeam, EnrichedPlayer, MetricKey } from "./types.ts";

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

export interface SquadCol {
  key: string;
  label: string;
  rate: boolean;
}
export interface SquadRow {
  key: string; // `${team}::${player}` for the player modal
  player: string;
  pos: string | null;
  nation: string | null;
  role: string | null; // data-driven role
  mp: number;
  minutes: number;
  out: number | null; // output score (null for keepers)
  values: (number | null)[]; // aligned to the group's cols
  pcts: (number | null)[]; // percentiles, for heat colouring
}
export interface SquadGroup {
  group: string; // GK / DF / MF / FW
  label: string;
  cols: SquadCol[];
  rows: SquadRow[];
}

export interface PlayerDot {
  key: string; // `${team}::${player}` for the player modal
  player: string;
  pos: string | null;
  cx: number; // depth 0-1 (own goal → attack)
  cy: number; // width 0-1
  cxA: number; cyA: number; // attacking shape
  cxD: number; cyD: number; // defending shape
  out: number | null;
  minutes: number;
  isGk: boolean;
  role: string | null; // data-driven role
}

export interface RoleSlot {
  role: string;
  bucket: string;
  players: { key: string; player: string; out: number | null }[];
  bestOut: number | null;
}
export interface RoleUpgrade {
  role: string;
  currentPlayer: string | null;
  currentOut: number | null;
  reason: "kvalitet" | "dybde" | "begge"; // WHY this role is a transfer target
  candidates: { key: string; player: string; team: string; league: string; out: number | null; age: number | null }[];
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
  squad: SquadGroup[]; // players by position with position-appropriate stats
  roleMakeup: RoleSlot[]; // squad grouped by data-driven role
  roleUpgrades: RoleUpgrade[]; // weakest-covered roles + cross-league candidates
  formations: Formation[]; // most-used formations this season (top first)
  style: TeamStyle | null; // in-possession + out-of-possession playing style

  positions: PlayerDot[]; // squad avg positions (heatmap centroids), coloured by OUT
  heatmap: Heatmap | null; // minute-weighted composite of the outfield squad
  // defensive-zone weakness + recruitment fits (existing engine)
  zones: ZoneCover[];
  goalsAgainst: number | null;
  bigChancesAgainst: number | null;
}

const posGroupOf = (pos: string | null): string => {
  const t = (pos ?? "").split(",")[0]?.trim() ?? "";
  return ["GK", "DF", "MF", "FW"].includes(t) ? t : "?";
};

// Position-appropriate key stats per line. Columns read EnrichedPlayer.per90
// (rates as-is) + .percentile (for the heat bar).
const SQUAD_COLS: Record<string, SquadCol[]> = {
  FW: [
    { key: "goals", label: "Mål", rate: false },
    { key: "xg", label: "xG", rate: false },
    { key: "assists", label: "Assist", rate: false },
    { key: "shots", label: "Skud", rate: false },
    { key: "key_passes", label: "Chances", rate: false },
    { key: "dribbles", label: "Dribl.", rate: false },
  ],
  MF: [
    { key: "assists", label: "Assist", rate: false },
    { key: "xa", label: "xA", rate: false },
    { key: "key_passes", label: "Chances", rate: false },
    { key: "pass_pct", label: "Pass%", rate: true },
    { key: "dribbles", label: "Dribl.", rate: false },
    { key: "ball_recovery", label: "Gen.erob.", rate: false },
  ],
  DF: [
    { key: "tackles", label: "Tklr", rate: false },
    { key: "interceptions", label: "Erob.", rate: false },
    { key: "clearances", label: "Clear.", rate: false },
    { key: "aerial_won", label: "Luft", rate: false },
    { key: "duels_won_pct", label: "Duel%", rate: true },
  ],
  GK: [
    { key: "gk_clean_sheets", label: "Clean sh.", rate: false },
    { key: "gk_save_pct", label: "Save%", rate: true },
    { key: "gk_goals_prevented", label: "Goals prev.", rate: false },
  ],
};
const GROUP_LABEL: Record<string, string> = {
  GK: "Målmænd", DF: "Forsvar", MF: "Midtbane", FW: "Angreb",
};
const GROUP_ORDER = ["GK", "DF", "MF", "FW"];

// Resolve a clicked (Sofascore-spelled) team name to the FBref team name the
// player rows use. Exact normalised match first; then a SUBSET match so a short
// club code lines up with its full name ("PSV" ↔ "PSV Eindhoven", "AZ" ↔ "AZ
// Alkmaar"); then a distinctive-token overlap ("Red Bull Salzburg" ↔ "RB
// Salzburg", "SV 07 Elversberg" ↔ "Elversberg").
function resolvePlayerTeam(league: string, clicked: string, players: EnrichedPlayer[]): string | null {
  const nt = normTeam(clicked);
  const inLeague = players.filter((p) => p.league === league);
  const exact = inLeague.find((p) => normTeam(p.team) === nt);
  if (exact) return exact.team;

  const toks = (s: string) => new Set(normTeam(s).split(" ").filter((t) => t.length >= 2));
  const target = toks(clicked);
  const teams = [...new Set(inLeague.map((p) => p.team))];

  // Subset match: one name's tokens fully contained in the other's (both non-empty).
  let subBest: string | null = null;
  let subShared = 0;
  for (const team of teams) {
    const tt = toks(team);
    if (!tt.size || !target.size) continue;
    const shared = [...tt].filter((t) => target.has(t)).length;
    const subset = shared === tt.size || shared === target.size;
    if (subset && shared > subShared) {
      subShared = shared;
      subBest = team;
    }
  }
  if (subBest) return subBest;

  // Distinctive-token overlap (needs a solid shared token of length >= 4).
  const t3 = new Set([...target].filter((t) => t.length >= 3));
  let best: string | null = null;
  let bestLen = 0;
  for (const team of teams) {
    let sharedLen = 0;
    for (const tok of toks(team)) if (tok.length >= 3 && t3.has(tok)) sharedLen += tok.length;
    if (sharedLen > bestLen) {
      bestLen = sharedLen;
      best = team;
    }
  }
  return bestLen >= 4 ? best : null;
}

function buildSquad(league: string, teamName: string, players: EnrichedPlayer[]): SquadGroup[] {
  const mine = players.filter(
    (p) => p.league === league && p.team === teamName && (p.minutes ?? 0) > 0,
  );
  const centroids = getSquadCentroids(
    league,
    mine[0]?.season ?? "",
    mine.map((p) => p.sofascore_id).filter((x): x is number => x != null),
  );
  const groups: SquadGroup[] = [];
  for (const g of GROUP_ORDER) {
    const cols = SQUAD_COLS[g]!;
    const rows = mine
      .filter((p) => posGroupOf(p.pos) === g)
      .sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0))
      .map((p) => ({
        key: `${p.team}::${p.player}`,
        player: p.player,
        pos: (p.pos ?? "").split(",")[0]?.trim() ?? null,
        nation: p.nation ?? null,
        role: classifyRole(
          posGroupOf(p.pos),
          p.percentile as unknown as Record<string, number | null>,
          p.sofascore_id != null ? centroids.get(p.sofascore_id) ?? null : null,
        ).primary?.role ?? null,
        mp: p.mp,
        minutes: p.minutes,
        out: p.outputScore == null ? null : Math.round(p.outputScore),
        values: cols.map((c) => p.per90[c.key as MetricKey] ?? null),
        pcts: cols.map((c) => p.percentile[c.key as MetricKey] ?? null),
      }));
    if (rows.length) groups.push({ group: g, label: GROUP_LABEL[g]!, cols, rows });
  }
  return groups;
}

export function getTeamReport(league: string, team: string): TeamReport | null {
  const { players } = getCrossLeaguePlayers();
  // Player rows use FBref spelling; the clicked name is Sofascore's — resolve it
  // so squad + weakness engine find the right players (many clubs differ).
  const playerTeam = resolvePlayerTeam(league, team, players);
  const squad = playerTeam ? buildSquad(league, playerTeam, players) : [];
  // Weakness/fit engine keys off the FBref player-team spelling.
  const weakness = getTeamWeakness(league, playerTeam ?? team);

  // Minute-weighted composite heatmap from the outfield squad's season grids.
  const teamPlayers = playerTeam
    ? players.filter((p) => p.league === league && p.team === playerTeam)
    : [];
  const hmSeason = teamPlayers[0]?.season ?? "";
  const heatmap = teamPlayers.length
    ? getTeamHeatmap(
        league,
        hmSeason,
        teamPlayers.map((p) => ({ id: p.sofascore_id, minutes: p.minutes, isGk: p.gk_saves != null })),
      )
    : null;

  // Squad average positions (from heatmap centroids) — the team's real shape,
  // each player coloured by OUT. Regulars only, so it reads as a lineup.
  const centroids = getSquadCentroids(
    league,
    hmSeason,
    teamPlayers.map((p) => p.sofascore_id).filter((x): x is number => x != null),
  );
  const positions: PlayerDot[] = teamPlayers
    .filter((p) => p.sofascore_id != null && (p.minutes ?? 0) >= 600 && centroids.has(p.sofascore_id!))
    .map((p) => {
      const c = centroids.get(p.sofascore_id!)!;
      return {
        key: `${p.team}::${p.player}`,
        player: p.player,
        pos: (p.pos ?? "").split(",")[0]?.trim() ?? null,
        cx: c.cx, cy: c.cy,
        cxA: c.cxA, cyA: c.cyA,
        cxD: c.cxD, cyD: c.cyD,
        out: p.outputScore == null ? null : Math.round(p.outputScore),
        minutes: p.minutes,
        isGk: p.gk_saves != null,
        role: classifyRole(posGroupOf(p.pos), p.percentile as unknown as Record<string, number | null>, c).primary?.role ?? null,
      };
    })
    .sort((a, b) => b.minutes - a.minutes);

  // Find the league-season this team plays in (latest first) and its siblings,
  // so we can rank each metric within the league.
  const nt = normTeam(team);
  const seasons = getTeamLeagueSeasons().filter((s) => s.league === league);
  let siblings: EnrichedTeam[] = [];
  let me: EnrichedTeam | undefined;
  let seasonLabel = "";
  let seasonCode = "";
  for (const s of seasons) {
    const ts = getTeams(league, s.season);
    const found = ts.find((t) => normTeam(t.team) === nt);
    if (found) {
      siblings = ts;
      me = found;
      seasonLabel = s.season_label;
      seasonCode = s.season;
      break;
    }
  }
  const formations = me ? getTeamFormations(league, seasonCode, me.sofascore_team_id) : [];

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
        label: m.full,
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

  // Team playing-style signals (percentiles within the league). Team-metric
  // percentiles come from getTeams; crossing volume + high turnovers are summed
  // from the league's players; long-ball share + corners from the team rows.
  let style: TeamStyle | null = null;
  if (me) {
    const leaguePlayers = players.filter((p) => p.league === league);
    const agg = new Map<string, { crosses: number; press: number }>();
    for (const p of leaguePlayers) {
      const a = agg.get(p.team) ?? { crosses: 0, press: 0 };
      a.crosses += p.acc_crosses ?? 0;
      a.press += p.poss_won_att_third ?? 0;
      agg.set(p.team, a);
    }
    const pctOf = (arr: number[], v: number | null | undefined) => {
      if (v == null || !arr.length) return 50;
      const s = [...arr].sort((x, y) => x - y);
      return (s.filter((x) => x <= v).length / s.length) * 100;
    };
    const mine = playerTeam ? agg.get(playerTeam) : undefined;
    const crosses = pctOf([...agg.values()].map((a) => a.crosses), mine?.crosses);
    const pressHigh = pctOf([...agg.values()].map((a) => a.press), mine?.press);
    const lbShare = (t: EnrichedTeam) => (t.accurate_passes ? t.accurate_long_balls / t.accurate_passes : 0);
    const cornerRate = (t: EnrichedTeam) => (t.matches ? t.corners / t.matches : 0);
    const longball = pctOf(siblings.map(lbShare), lbShare(me));
    const corners = pctOf(siblings.map(cornerRate), cornerRate(me));
    const pc = (k: keyof typeof me.percentile) => me.percentile[k] ?? 50;
    style = classifyTeamStyle({
      possession: pc("possession"), pass_pct: pc("pass_pct"), xg: pc("xg"), big_chances: pc("big_chances"),
      interceptions: pc("interceptions"), tackles: pc("tackles"), duels: pc("duels_won_pct"),
      aerials: pc("aerials_won_pct"), solidShots: pc("shots_against"), cleanSheets: pc("clean_sheets"),
      longball, corners, crosses, pressHigh,
    });
  }

  // Role composition + gaps: group the squad by its data-driven role, then for the
  // weakest-covered roles surface higher-OUT players of the same role from other
  // clubs (cross-league). Reuses the shortlist payload (cached) as the role pool.
  const roleMakeup: RoleSlot[] = [];
  const roleUpgrades: RoleUpgrade[] = [];
  {
    const rows = squad.flatMap((g) => g.rows);
    const byRole = new Map<string, { key: string; player: string; out: number | null }[]>();
    for (const r of rows) {
      if (!r.role) continue;
      (byRole.get(r.role) ?? byRole.set(r.role, []).get(r.role)!).push({ key: r.key, player: r.player, out: r.out });
    }
    for (const [role, ps] of byRole) {
      ps.sort((a, b) => (b.out ?? -1) - (a.out ?? -1));
      const bestOut = ps[0]?.out ?? null;
      roleMakeup.push({ role, bucket: ROLE_BUCKET[role] ?? "?", players: ps, bestOut });
    }
    roleMakeup.sort((a, b) => BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket) || (b.bestOut ?? 0) - (a.bestOut ?? 0));

    // Role pool for upgrades (cross-league, by role, sorted by OUT).
    const sl = getShortlistData();
    const pool = new Map<string, typeof sl.players>();
    for (const p of sl.players) {
      if (!p.role || (p.min ?? 0) < 600) continue;
      (pool.get(p.role) ?? pool.set(p.role, []).get(p.role)!).push(p);
    }
    for (const arr of pool.values()) arr.sort((a, b) => (b.out ?? -1) - (a.out ?? -1));

    // A role only becomes a transfer target if there's a genuine NEED, not just
    // because it's the weakest slot on the pitch. Two triggers:
    //   1. QUALITY — the role's best player is below the cross-league median OUT
    //      (keeper vs. outfield medians kept apart, since they score differently).
    //   2. DEPTH — the position line is thin. Counted from the FULL squad (players
    //      with real minutes), NOT from roles: a club can have 5 CBs in the squad
    //      but only 3 with enough minutes to earn a role.
    const median = (arr: number[]): number => {
      if (!arr.length) return 50;
      const s = [...arr].sort((a, b) => a - b);
      const m = s.length >> 1;
      return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
    };
    const qualOut = median(sl.players.filter((p) => !p.isGk && p.out != null && (p.min ?? 0) >= 600).map((p) => p.out!));
    const qualGk = median(sl.players.filter((p) => p.isGk && p.out != null && (p.min ?? 0) >= 600).map((p) => p.out!));

    // Line depth from the squad (position group), floor at role-qualification minutes.
    // No GK line: a backup keeper rarely logs 450+ league minutes, so every club
    // would read as thin at GK — keepers are a quality-only signal.
    const REGULAR_MIN = 450;
    const LINE_MIN: Record<string, number> = { DF: 5, MF: 4, FW: 2 };
    const lineCount: Record<string, number> = {};
    const playerLine = new Map<string, string>();
    for (const g of squad)
      for (const r of g.rows) {
        playerLine.set(r.key, g.group);
        if (r.minutes >= REGULAR_MIN) lineCount[g.group] = (lineCount[g.group] ?? 0) + 1;
      }
    // A role's line = the group most of its players actually sit in.
    const roleLine = (ps: { key: string }[]): string | null => {
      const tally: Record<string, number> = {};
      for (const p of ps) { const g = playerLine.get(p.key); if (g) tally[g] = (tally[g] ?? 0) + 1; }
      return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    };

    const targets: (RoleUpgrade & { need: number })[] = [];
    for (const slot of roleMakeup) {
      const isGk = slot.bucket === "GK";
      const qualThresh = isGk ? qualGk : qualOut;
      const qualGap = slot.bestOut != null && slot.bestOut < qualThresh;
      const line = roleLine(slot.players);
      const thin = line != null && (lineCount[line] ?? 0) < (LINE_MIN[line] ?? 0);
      if (!qualGap && !thin) continue;
      const reason: RoleUpgrade["reason"] = qualGap && thin ? "begge" : qualGap ? "kvalitet" : "dybde";
      // For a pure depth need, show the best profiles in the role (adding a body);
      // for a quality need, only players clearly above who we already have.
      const cands = (pool.get(slot.role) ?? [])
        .filter((c) => normTeam(c.t) !== nt && (reason === "dybde" || (c.out ?? -1) > (slot.bestOut ?? -1)))
        .slice(0, 5)
        .map((c) => ({ key: c.key, player: c.n, team: c.t, league: c.lg, out: c.out, age: c.age }));
      // Rank by need: quality gaps first (by how far below the bar), then depth.
      const need = qualGap ? 100 + (qualThresh - (slot.bestOut ?? qualThresh)) : (LINE_MIN[line!] ?? 0) - (lineCount[line!] ?? 0);
      targets.push({ role: slot.role, currentPlayer: slot.players[0]?.player ?? null, currentOut: slot.bestOut, reason, candidates: cands, need });
    }
    targets.sort((a, b) => b.need - a.need);
    for (const t of targets.slice(0, 6)) roleUpgrades.push({ role: t.role, currentPlayer: t.currentPlayer, currentOut: t.currentOut, reason: t.reason, candidates: t.candidates });
  }

  // Nothing to show at all → let the caller 404. Otherwise render whatever we have
  // (team stats OR squad OR zones), so a name mismatch never blanks the whole report.
  if (!me && squad.length === 0 && !weakness) return null;

  return {
    team: me?.team ?? weakness?.team ?? team,
    league,
    season_label: seasonLabel,
    matches: me?.matches ?? null,
    rating: me?.avg_rating ?? null,
    ratingRank,
    teamsInLeague: siblings.length,
    metrics,
    strengths,
    weaknesses,
    squad,
    roleMakeup,
    roleUpgrades,
    formations,
    style,
    positions,
    heatmap,
    zones: weakness?.zones ?? [],
    goalsAgainst: me?.value["goals_conceded"] ?? weakness?.goalsAgainst ?? null,
    bigChancesAgainst: me?.value["big_chances_against"] ?? weakness?.bigChancesAgainst ?? null,
  };
}
