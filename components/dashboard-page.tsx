import { SiteHeader } from "@/components/site-header";
import { DashboardView } from "@/components/dashboard-view";
import type { PlayerPoint, TeamPoint } from "@/components/scatter-dashboard";
import type { DashPlayer } from "@/components/top-lists";
import type { DashTeam } from "@/components/team-lists";
import { getCrossLeaguePlayers } from "@/lib/players";
import { getAllTeams } from "@/lib/teams";
import { PLAYER_AXES, TEAM_AXES } from "@/lib/scatter-axes";

const LIST_MIN = 540; // leaderboard qualification (minutes ~ 6 games)
const DASH_METRICS = [
  "npg", "key_passes", "big_chances_created", "dribbles",
  "ball_recovery", "tackles", "aerial_won", "pass_pct",
];
const TEAM_DASH_METRICS = [
  "goals", "xg", "big_chances", "possession", "pass_pct",
  "goals_conceded", "shots_against", "clean_sheets",
];

/** Shared body for both dashboard routes (/ = players, /hold = teams). */
export function DashboardPage({ mode }: { mode: "players" | "teams" }) {
  const { players } = getCrossLeaguePlayers();
  const teams = getAllTeams();

  const playerPoints: PlayerPoint[] = players
    .filter((p) => (p.minutes ?? 0) >= 450)
    .map((p) => {
      const per90 = p.per90 as unknown as Record<string, number | null>;
      return {
        n: p.player, t: p.team, lg: p.league, age: p.age ?? null, min: p.minutes,
        out: p.outputScore == null ? null : Math.round(p.outputScore),
        v: Object.fromEntries(PLAYER_AXES.map((a) => [a.key, per90[a.key] ?? null])),
      };
    });

  const teamPoints: TeamPoint[] = teams.map((t) => {
    const value = t.value as unknown as Record<string, number | null>;
    return {
      n: t.team, lg: t.league,
      v: Object.fromEntries(TEAM_AXES.map((a) => [a.key, value[a.key] ?? null])),
    };
  });

  const dashPlayers: DashPlayer[] = players
    .filter((p) => (p.minutes ?? 0) >= LIST_MIN)
    .map((p) => {
      const per90 = p.per90 as unknown as Record<string, number | null>;
      return {
        n: p.player, t: p.team, lg: p.league, age: p.age ?? null, min: p.minutes,
        out: p.outputScore == null ? null : Math.round(p.outputScore),
        xg: p.xg, goals: p.goals, gp: p.gk_goals_prevented, isGk: p.gk_saves != null,
        m: Object.fromEntries(DASH_METRICS.map((k) => [k, per90[k] ?? null])),
      };
    });

  const dashTeams: DashTeam[] = teams.map((t) => {
    const value = t.value as unknown as Record<string, number | null>;
    return {
      n: t.team, lg: t.league, matches: t.matches, rating: t.avg_rating ?? null,
      m: Object.fromEntries(TEAM_DASH_METRICS.map((k) => [k, value[k] ?? null])),
    };
  });

  const leagueCount = new Set(teams.map((t) => t.league)).size;
  const isPlayers = mode === "players";

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1440px] px-3 py-5 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-volt">
              OTO · one to one
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {isPlayers ? "Spiller-overblik" : "Hold-overblik"}
              <span className="ml-3 align-middle font-mono text-sm font-normal text-muted">
                hvem stikker ud lige nu
              </span>
            </h1>
          </div>
          <div className="text-right">
            <div className="tnum text-3xl font-bold text-volt">{leagueCount}</div>
            <div className="font-mono text-xs uppercase tracking-wider text-muted">
              ligaer · ingen top-5
            </div>
          </div>
        </div>

        <DashboardView
          mode={mode}
          playerPoints={playerPoints}
          teamPoints={teamPoints}
          dashPlayers={dashPlayers}
          dashTeams={dashTeams}
          listMin={LIST_MIN}
        />
      </main>
    </div>
  );
}
