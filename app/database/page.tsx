import { SiteHeader } from "@/components/site-header";
import { RawDatabase } from "@/components/raw-database";
import { getRawData } from "@/lib/raw-data";

export const dynamic = "force-dynamic";

export default function Page() {
  const { cols, rows, keys } = getRawData();
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1440px] px-3 py-5 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-volt">OTO · rå data</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Raw Database
              <span className="ml-3 align-middle font-mono text-sm font-normal text-muted">
                alle kolonner · sortér · eksportér
              </span>
            </h1>
          </div>
          <div className="text-right">
            <div className="tnum text-3xl font-bold text-volt">{rows.length}</div>
            <div className="font-mono text-xs uppercase tracking-wider text-muted">rækker</div>
          </div>
        </div>
        <RawDatabase cols={cols} rows={rows} keys={keys} />
      </main>
    </div>
  );
}
