import { SiteHeader } from "@/components/site-header";
import { BoardSwitch } from "@/components/board-switch";
import { getDefaultLeagueSeason, getEnrichedPlayers } from "@/lib/players";
import { getTeams, getTeamLeagueSeasons } from "@/lib/teams";
import { loadModelConfig } from "@/lib/model";

// Local tool: always re-read scouting.db + config/model.json on request, so a
// re-fetch or a weight tweak shows on refresh without a rebuild.
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string; season?: string }>;
}) {
  const ls = getDefaultLeagueSeason();

  if (!ls) {
    return (
      <div className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-5 py-24 sm:px-8">
          <h1 className="font-display text-3xl font-bold">No data yet.</h1>
          <p className="mt-3 text-muted">Build the local database first:</p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel/50 p-4 font-mono text-xs text-volt">
            python pipeline/fetch.py --league DEN-Superliga --season 2025-2026
          </pre>
        </main>
      </div>
    );
  }

  const config = loadModelConfig();

  // One league/season selector drives BOTH boards — FBref (players) and
  // Sofascore (teams) share the same season codes (Superliga 2526, Nordic 2026).
  const teamOptions = getTeamLeagueSeasons();
  const sp = await searchParams;
  const selected =
    teamOptions.find((o) => o.league === sp.league && o.season === sp.season) ??
    teamOptions[0] ??
    { league: ls.league, season: ls.season, season_label: ls.season_label };

  const { players, xgMatched, xgTotal, comparedTo } = getEnrichedPlayers(
    selected.league,
    selected.season,
  );
  const teams = getTeams(selected.league, selected.season);

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="w-full px-3 py-5 sm:px-6 sm:py-8">
        <BoardSwitch
          players={players}
          teams={teams}
          teamOptions={teamOptions}
          selectedTeam={selected}
          groups={config.groups}
          rates={config.rates}
          comparedTo={comparedTo}
        />

        <p className="mt-6 font-mono text-xs text-faint">
          OUT = weighted output score (per-90 percentiles, see config/model.json) ·
          data: FBref (counting) + Sofascore (xG/xA/goals prevented) ·{" "}
          <span className="text-volt">
            xG matched for {xgMatched}/{xgTotal} players
          </span>{" "}
          (unmatched show —)
        </p>
      </main>
    </div>
  );
}
