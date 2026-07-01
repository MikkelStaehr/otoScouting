import { SiteHeader } from "@/components/site-header";
import {
  ScatterDashboard,
  type PlayerPoint,
  type TeamPoint,
} from "@/components/scatter-dashboard";
import { TopLists, type TopList } from "@/components/top-lists";
import { getCrossLeaguePlayers } from "@/lib/players";
import { getAllTeams } from "@/lib/teams";
import { PLAYER_AXES, TEAM_AXES } from "@/lib/scatter-axes";
import type { EnrichedPlayer } from "@/lib/types";

const LIST_MIN = 600; // leaderboard qualification (minutes)

/** Top-10 of a pool by a picked metric, formatted into list rows. */
function topN(
  pool: EnrichedPlayer[],
  pick: (p: EnrichedPlayer) => number | null | undefined,
  fmt: (v: number) => string,
  hint?: (p: EnrichedPlayer) => string,
): TopList["rows"] {
  return pool
    .map((p) => ({ p, val: pick(p) }))
    .filter((x): x is { p: EnrichedPlayer; val: number } => x.val != null)
    .sort((a, b) => b.val - a.val)
    .slice(0, 10)
    .map(({ p, val }) => ({
      n: p.player,
      t: p.team,
      lg: p.league,
      v: fmt(val),
      hint: hint ? hint(p) : undefined,
    }));
}

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

  // ── curated top-10 leaderboards across all leagues ──
  const per90Of = (p: EnrichedPlayer, k: string) =>
    (p.per90 as unknown as Record<string, number | null>)[k] ?? null;
  const qual = players.filter((p) => (p.minutes ?? 0) >= LIST_MIN);
  const gks = players.filter((p) => p.gk_saves != null && (p.minutes ?? 0) >= 450);

  const lists: TopList[] = [
    {
      key: "danger", title: "Mest målfarlige", sub: "mål u. straffe pr. 90",
      rows: topN(qual, (p) => per90Of(p, "npg"), (v) => v.toFixed(2)),
    },
    {
      key: "out", title: "Bedste output lige nu", sub: "OUT · ligastyrke-justeret",
      rows: topN(qual, (p) => p.outputScore, (v) => String(Math.round(v))),
    },
    {
      key: "u21", title: "Ones to watch · U21", sub: "unge der leverer (OUT)",
      rows: topN(
        qual.filter((p) => p.age != null && p.age <= 21),
        (p) => p.outputScore,
        (v) => String(Math.round(v)),
        (p) => `${p.age} år`,
      ),
    },
    {
      key: "creators", title: "Kreatørerne", sub: "forventede assists pr. 90",
      rows: topN(qual, (p) => per90Of(p, "xa"), (v) => v.toFixed(2)),
    },
    {
      key: "underperf", title: "Uforløst — mål venter", sub: "xG minus mål (bør score mere)",
      rows: topN(
        qual.filter((p) => (p.xg ?? 0) >= 3),
        (p) => (p.xg ?? 0) - p.goals,
        (v) => `+${v.toFixed(1)}`,
      ),
    },
    {
      key: "gk", title: "Målmænd", sub: "reddet vs forventet",
      rows: topN(gks, (p) => p.gk_goals_prevented, (v) => v.toFixed(1)),
    },
  ];

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

        <div className="mt-8">
          <div className="mb-3 flex flex-wrap items-baseline gap-3 border-b border-line pb-2">
            <h2 className="font-display text-lg font-bold text-fg">Top-lister</h2>
            <span className="font-mono text-[11px] text-faint">
              på tværs af alle ligaer · min. {LIST_MIN} min. spilletid
            </span>
          </div>
          <TopLists lists={lists} />
        </div>
      </main>
    </div>
  );
}
