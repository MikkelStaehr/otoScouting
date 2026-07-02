"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { openPalette } from "./command-palette";
import { openSettings } from "./settings-modal";

const NAV = [
  { href: "/", label: "Spillere" },
  { href: "/hold", label: "Hold" },
  { href: "/board", label: "Database" },
  { href: "/shortlist", label: "Shortlist" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/60 backdrop-blur-md">
      <div className="flex w-full items-center justify-between gap-4 px-3 py-3 sm:px-6">
        <div className="flex items-center gap-5">
          <Link href="/" className="group flex items-baseline gap-2">
            <span className="font-display text-lg font-bold tracking-tight text-fg">
              oto<span className="text-volt">scout</span>
            </span>
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-faint sm:block">
              1:1 scouting
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => {
              const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-lg px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                    active ? "bg-volt/15 text-volt" : "text-faint hover:text-fg"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>

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
