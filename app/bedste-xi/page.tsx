import { SiteHeader } from "@/components/site-header";
import { BestXIPitch } from "@/components/best-xi-pitch";
import { pickBestXI } from "@/lib/best-xi";

export const dynamic = "force-dynamic";

export default function Page() {
  const xi = pickBestXI();
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-volt">OTO · elleveren</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Bedste XI
              <span className="ml-3 align-middle font-mono text-sm font-normal text-muted">
                4-3-3 · sæsonens bedste på tværs af ligaerne
              </span>
            </h1>
          </div>
          <div className="text-right">
            <div className="tnum text-3xl font-bold text-volt">{xi.poolSize}</div>
            <div className="font-mono text-xs uppercase tracking-wider text-muted">kvalificerede</div>
          </div>
        </div>

        <BestXIPitch xi={xi} />

        <p className="mt-8 max-w-3xl font-mono text-[11px] leading-relaxed text-faint">
          Positioner fra rolle-modellen (GK/CB/back/midt/kant/angreb), rangeret efter{" "}
          <span className="text-muted">OUT</span> — den strength-justerede output-score på tværs af
          alle scouting-ligaer (big-5-benchmark ekskluderet). Kun spillere med ≥900 min. Målmænd
          rangeres på goals-prevented (OUT er en markspiller-score). Klik en spiller for detaljer.
        </p>
      </main>
    </div>
  );
}
