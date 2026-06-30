import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col items-start px-5 py-32 sm:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-volt">
          404
        </p>
        <h1 className="mt-4 font-display text-5xl font-bold tracking-tight">
          Out of bounds.
        </h1>
        <p className="mt-4 max-w-md text-muted">
          That page isn&apos;t part of the scouting board.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-lg border border-line-2 px-4 py-2 text-sm text-fg transition-colors hover:border-volt/50"
        >
          ← Back to the board
        </Link>
      </main>
    </div>
  );
}
