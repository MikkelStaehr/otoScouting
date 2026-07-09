import { SiteHeader } from "@/components/site-header";
import { BoardSwitch } from "@/components/board-switch";
import {
  getDefaultLeagueSeason,
  getEnrichedPlayers,
  getCrossLeaguePlayers,
} from "@/lib/players";
import { getTeams, getCrossLeagueTeams, getTeamLeagueSeasons } from "@/lib/teams";
import { ALL_LEAGUES } from "@/lib/league-config";
import { loadModelConfig } from "@/lib/model";

// Local tool: always re-read scouting.db + config/model.json on request, so a
// re-fetch or a weight tweak shows on refresh without a rebuild.
export const dynamic = "force-dynamic";

export default async function BoardPage({
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
            python pipeline/ingest.py
          </pre>
        </main>
      </div>
    );
  }

  const config = loadModelConfig();

  // One league/season selector drives BOTH boards — FBref (players) and
  // Sofascore (teams) share the same season codes (Superliga 2526, Nordic 2026).
  // A special "ALL" selection pools every league for cross-league ranking.
  const teamOptions = getTeamLeagueSeasons();
  const sp = await searchParams;
  const crossLeague = sp.league === ALL_LEAGUES;
  const selected = crossLeague
    ? { league: ALL_LEAGUES, season: "", season_label: "2026" }
    : teamOptions.find((o) => o.league === sp.league && o.season === sp.season) ??
      teamOptions[0] ??
      { league: ls.league, season: ls.season, season_label: ls.season_label };

  const board = crossLeague
    ? getCrossLeaguePlayers()
    : getEnrichedPlayers(selected.league, selected.season);
  const { xgMatched, xgTotal, comparedTo } = board;
  // Cross-league is the prospect finder — send only qualified players (>= minMinutes).
  // Cuts the client payload ~30% and drops tiny-sample OUT=100 noise; single-league
  // keeps the full roster (unqualified rendered dimmed).
  const players = crossLeague ? board.players.filter((p) => p.qualified) : board.players;
  // Cross-league: the Table of Justice for teams (strength-adjusted pool). Otherwise
  // the per-league team ranking.
  const teams = crossLeague ? getCrossLeagueTeams() : getTeams(selected.league, selected.season);

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="w-full px-3 py-5 sm:px-6 sm:py-8">
        <BoardSwitch
          players={players}
          teams={teams}
          teamOptions={teamOptions}
          selectedTeam={selected}
          crossLeague={crossLeague}
          groups={config.groups}
          rates={config.rates}
          comparedTo={comparedTo}
        />

        <p className="mt-6 font-mono text-xs text-faint">
          OUT = weighted output score (per-90 percentiles, see config/model.json) ·
          {crossLeague && (
            <span className="text-muted">
              {" "}percentiler på tværs af alle ligaer, output vægtet efter
              ligastyrke (Elo, se config/leagues.json) ·
            </span>
          )}{" "}
          data: FBref (counting) + Sofascore (xG/xA/goals prevented) ·{" "}
          {xgMatched === 0 ? (
            <span className="text-muted">
              ingen xG for denne liga (Sofascore-dækning)
            </span>
          ) : (
            <>
              <span className="text-volt">
                xG for {xgMatched}/{xgTotal} players
              </span>{" "}
              (resten viser —)
            </>
          )}
        </p>
      </main>
    </div>
  );
}
