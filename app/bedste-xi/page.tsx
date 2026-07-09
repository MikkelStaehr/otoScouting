import { SiteHeader } from "@/components/site-header";
import { BestXIPitch } from "@/components/best-xi-pitch";
import { BestXIControls } from "@/components/best-xi-controls";
import { pickBestXI, xiFacets, type XIOptions } from "@/lib/best-xi";
import { leagueLabel } from "@/lib/league-meta";

export const dynamic = "force-dynamic";

const SUBTITLE: Record<string, string> = {
  samlet: "sæsonens bedste på tværs af ligaerne",
  u21: "sæsonens bedste U21 (≤21 år)",
  bargain: "bedste værdi — OUT per million €",
  nation: "form-landshold — bedste XI af én nation",
  liga: "sæsonens hold i én liga",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; lens?: string; nation?: string; league?: string; pool?: string }>;
}) {
  const sp = await searchParams;
  const metric = sp.metric === "form" ? "form" : "season";
  const pool = sp.pool === "scouting" ? "scouting" : "all";
  const lens = sp.lens ?? "samlet";
  const facets = xiFacets(pool);
  const nation = sp.nation ?? facets.nations[0]?.code ?? "";
  const league = sp.league ?? facets.leagues[0]?.key ?? "";

  const opts: XIOptions = { metric, pool };
  if (lens === "u21") opts.maxAge = 21;
  else if (lens === "bargain") opts.bargain = true;
  else if (lens === "nation") opts.nation = nation;
  else if (lens === "liga") opts.league = league;
  const xi = pickBestXI(opts);

  const subtitle =
    lens === "nation"
      ? `form-landshold · ${nation}`
      : lens === "liga"
        ? `sæsonens hold · ${leagueLabel(league)}`
        : SUBTITLE[lens] ?? SUBTITLE.samlet;

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-volt">OTO · elleveren</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Bedste XI
              <span className="ml-3 align-middle font-mono text-sm font-normal text-muted">
                4-3-3 · {subtitle}
              </span>
            </h1>
          </div>
          <div className="text-right">
            <div className="tnum text-3xl font-bold text-volt">{xi.poolSize}</div>
            <div className="font-mono text-xs uppercase tracking-wider text-muted">kvalificerede</div>
          </div>
        </div>

        <div className="mb-6">
          <BestXIControls
            metric={metric}
            pool={pool}
            lens={lens}
            nation={nation}
            league={league}
            nations={facets.nations}
            leagues={facets.leagues}
          />
        </div>

        {metric === "form" && (
          <div className="mb-5 rounded-xl border border-line-2 bg-ink/30 px-4 py-3 font-mono text-[11px] leading-relaxed text-muted">
            <span className="text-volt">Form</span> = Δ(xG + xA) produceret siden sidste snapshot.
            Signalet <span className="text-fg">modnes med rigtig 14-dages-kadence</span> — lige nu
            bygger det på små dev-intervaller, så tag holdet med et gran salt.
          </div>
        )}

        <BestXIPitch xi={xi} />

        <p className="mt-8 max-w-3xl font-mono text-[11px] leading-relaxed text-faint">
          Positioner fra rolle-modellen (GK/CB/back/midt/kant/angreb), rangeret efter{" "}
          <span className="text-muted">OUT</span> — den strength-justerede output-score.{" "}
          {pool === "all"
            ? "Alle ligaer, inkl. big-5-benchmark (et ægte bedste hold)."
            : "Kun scouting-ligaer, big-5 ekskluderet (et bedste prospekt-hold)."}{" "}
          Kun spillere med ≥900 min. Målmænd rangeres på goals-prevented. Bargain rangerer på OUT
          per million €. Klik en spiller for detaljer.
        </p>
      </main>
    </div>
  );
}
