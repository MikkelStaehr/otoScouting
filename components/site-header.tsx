"use client";

import Link from "next/link";
import { openPalette } from "./command-palette";
import { openSettings } from "./settings-modal";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/60 backdrop-blur-md">
      <div className="flex w-full items-center justify-between px-3 py-3 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-lg font-bold tracking-tight text-fg">
            oto<span className="text-volt">scout</span>
          </span>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-faint sm:block">
            fbref scouting
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={openPalette}
            className="flex items-center gap-2 rounded-lg border border-line-2 bg-panel/60 px-3 py-1.5 text-sm text-muted transition-colors hover:border-volt/40 hover:text-fg"
          >
            <span>Search</span>
            <kbd className="select-none rounded border border-line-2 bg-ink px-1.5 py-0.5 font-mono text-[11px] text-muted">
              ⌘K
            </kbd>
          </button>
          <button
            onClick={openSettings}
            aria-label="Indstillinger"
            title="Indstillinger / opdater data"
            className="rounded-lg border border-line-2 bg-panel/60 px-2.5 py-1.5 text-muted transition-colors hover:border-volt/40 hover:text-fg"
          >
            ⚙
          </button>
        </div>
      </div>
    </header>
  );
}
