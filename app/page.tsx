import { SiteHeader } from "@/components/site-header";
import {
  ScatterDashboard,
  type PlayerPoint,
  type TeamPoint,
} from "@/components/scatter-dashboard";
import { getCrossLeaguePlayers } from "@/lib/players";
import { getAllTeams } from "@/lib/teams";
import { PLAYER_AXES, TEAM_AXES } from "@/lib/scatter-axes";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const { players } = getCrossLeaguePlayers();
  const teams = getAllTeams();

  // Compact points — only the plottable metrics cross the server→client wire.
  const playerPoints: PlayerPoint[] = players
    .filter((p) => (p.minutes ?? 0) >= 450)
    .map((p) => {
      const per90 = p.per90 as unknown as Record<string, number | null>;
      return {
        n: p.player,
        t: p.team,
        lg: p.league,
        age: p.age ?? null,
        min: p.minutes,
        out: p.outputScore == null ? null : Math.round(p.outputScore),
        v: Object.fromEntries(PLAYER_AXES.map((a) => [a.key, per90[a.key] ?? null])),
      };
    });

  const teamPoints: TeamPoint[] = teams.map((t) => {
    const value = t.value as unknown as Record<string, number | null>;
    return {
      n: t.team,
      lg: t.league,
      v: Object.fromEntries(TEAM_AXES.map((a) => [a.key, value[a.key] ?? null])),
    };
  });

  const leagueCount = new Set(teams.map((t) => t.league)).size;

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="w-full px-3 py-5 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-volt">
              OTO · one to one
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Europa-overblik
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

        <ScatterDashboard players={playerPoints} teams={teamPoints} />

        <p className="mt-4 font-mono text-xs text-faint">
          Sæt X og Y og se hvem der afviger fra mængden. Grøn stiplet = y=x
          (over/under-performance, fx mål vs xG). De mest markante navngives
          automatisk; søg for at fremhæve. Kun de små/producerende ligaer — det er
          hele pointen.
        </p>
      </main>
    </div>
  );
}
