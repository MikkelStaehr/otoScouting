import { SiteHeader } from "@/components/site-header";
import { DashboardView } from "@/components/dashboard-view";
import { getDashboardData, LIST_MIN } from "@/lib/dashboard";

/** Shared body for both dashboard routes (/ = players, /hold = teams). */
export function DashboardPage({ mode }: { mode: "players" | "teams" }) {
  const { playerPoints, teamPoints, dashPlayers, dashTeams, leagueCount } =
    getDashboardData();
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
