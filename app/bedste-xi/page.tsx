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
  searchParams: Promise<{ lens?: string; nation?: string; league?: string }>;
}) {
  const sp = await searchParams;
  const lens = sp.lens ?? "samlet";
  const facets = xiFacets();
  const nation = sp.nation ?? facets.nations[0]?.code ?? "";
  const league = sp.league ?? facets.leagues[0]?.key ?? "";

  const opts: XIOptions = {};
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
            lens={lens}
            nation={nation}
            league={league}
            nations={facets.nations}
            leagues={facets.leagues}
          />
        </div>

        <BestXIPitch xi={xi} />

        <p className="mt-8 max-w-3xl font-mono text-[11px] leading-relaxed text-faint">
          Positioner fra rolle-modellen (GK/CB/back/midt/kant/angreb), rangeret efter{" "}
          <span className="text-muted">OUT</span> — den strength-justerede output-score på tværs af
          alle scouting-ligaer (big-5-benchmark ekskluderet). Kun spillere med ≥900 min. Målmænd
          rangeres på goals-prevented. Bargain rangerer på OUT per million €. Klik en spiller for
          detaljer.
        </p>
      </main>
    </div>
  );
}
