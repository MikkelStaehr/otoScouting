import { SiteHeader } from "@/components/site-header";
import { ShortlistView } from "@/components/shortlist-view";
import { getShortlistData } from "@/lib/shortlist";

export const dynamic = "force-dynamic";

export default function Page() {
  const { players, leagues } = getShortlistData();
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1440px] px-3 py-5 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-volt">OTO · rekruttering</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Shortlist
              <span className="ml-3 align-middle font-mono text-sm font-normal text-muted">
                byg en profil · find navne · gem lister
              </span>
            </h1>
          </div>
          <div className="text-right">
            <div className="tnum text-3xl font-bold text-volt">{players.length}</div>
            <div className="font-mono text-xs uppercase tracking-wider text-muted">spillere i puljen</div>
          </div>
        </div>

        <ShortlistView players={players} leagues={leagues} />
      </main>
    </div>
  );
}
