"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayerTable } from "./player-table";
import { TeamTable } from "./team-table";
import { IconSelect, type Opt } from "./icon-select";
import { leagueLabel } from "@/lib/league-meta";
import { leagueFlagUrl } from "@/lib/flags";
import type { LeagueSeasonOption } from "@/lib/teams";
import type {
  EnrichedPlayer,
  EnrichedTeam,
  GroupKey,
  MetricKey,
} from "@/lib/types";

function FlagImg({ url }: { url: string | null }) {
  if (!url) return <span className="inline-block h-2.5 w-3.5 shrink-0" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="inline-block h-2.5 w-auto shrink-0 rounded-[1px]" />;
}

export function BoardSwitch({
  players,
  teams,
  teamOptions,
  selectedTeam,
  crossLeague = false,
  groups,
  rates,
  comparedTo,
}: {
  players: EnrichedPlayer[];
  teams: EnrichedTeam[];
  teamOptions: LeagueSeasonOption[];
  selectedTeam: LeagueSeasonOption | null;
  crossLeague?: boolean;
  groups: Record<GroupKey, MetricKey[]>;
  rates: MetricKey[];
  comparedTo: string | null;
}) {
  // Scope (Hold / Spillere) is the user's choice and persists across league changes —
  // both work cross-league now (the Table of Justice covers teams too).
  const [scope, setScope] = useState<"players" | "teams">("teams");
  const router = useRouter();

  const leagues = [...new Set(teamOptions.map((o) => o.league))];
  const seasonsForSelected = teamOptions.filter(
    (o) => o.league === selectedTeam?.league,
  );

  function pick(league: string, season: string) {
    router.push(`/board?league=${encodeURIComponent(league)}&season=${season}`, {
      scroll: false,
    });
  }

  // One selector drives both boards, so the header is just the selected
  // league/season; only the count + unit change with the active tab.
  const isTeams = scope === "teams";
  const headLeague = crossLeague
    ? "Alle ligaer"
    : (selectedTeam?.league ?? "").replace("-", " · ");
  const headLabel = selectedTeam?.season_label ?? "";
  const headCount = isTeams ? teams.length : players.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-volt">
            {headLeague}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {headLabel}
            <span className="ml-3 align-middle font-mono text-sm font-normal text-muted">
              scouting board
            </span>
          </h1>
        </div>
        <div className="text-right">
          <div className="tnum text-3xl font-bold text-volt">{headCount}</div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted">
            {isTeams ? "hold" : "spillere"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex overflow-hidden rounded-lg border border-line-2">
          {(["teams", "players"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-6 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                scope === s ? "bg-volt text-ink" : "bg-panel/40 text-muted hover:text-fg"
              }`}
            >
              {s === "players" ? "Spillere" : "Hold"}
            </button>
          ))}
        </div>

        {/* League + season selector drives both boards. */}
        {leagues.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <IconSelect
              label="Liga"
              value={crossLeague ? "ALL" : selectedTeam?.league ?? ""}
              onChange={(v) => {
                if (v === "ALL") pick("ALL", "");
                else pick(v, teamOptions.find((o) => o.league === v)?.season ?? "");
              }}
              minWidth={170}
              options={[
                ...leagues.map((lg): Opt => ({ value: lg, label: leagueLabel(lg), icon: <FlagImg url={leagueFlagUrl(lg)} /> })),
                { value: "ALL", label: "⚑ Alle ligaer", icon: <span className="inline-block h-2.5 w-3.5" /> },
              ]}
            />
            {seasonsForSelected.length > 1 && (
              <span className="flex items-center gap-1">
                {seasonsForSelected.map((o) => (
                  <button
                    key={o.season}
                    onClick={() => pick(o.league, o.season)}
                    className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors ${
                      selectedTeam?.season === o.season
                        ? "border-volt/50 bg-volt/15 text-volt"
                        : "border-line-2 text-faint hover:text-muted"
                    }`}
                  >
                    {o.season_label}
                  </button>
                ))}
              </span>
            )}
          </div>
        )}

      </div>

      {scope === "players" ? (
        <PlayerTable
          players={players}
          groups={groups}
          rates={rates}
          comparedTo={comparedTo}
          crossLeague={crossLeague}
        />
      ) : (
        <TeamTable teams={teams} crossLeague={crossLeague} />
      )}
    </div>
  );
}
