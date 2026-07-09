"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fuzzyFilter } from "@/lib/fuzzy";
import type { PlayerIndexRow } from "@/lib/types";
import { FOCUS_EVENT } from "./player-table";

const OPEN_EVENT = "otoscout:open-palette";

/** Dispatch from anywhere (e.g. a header button) to open the palette. */
export function openPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const MAX_RESULTS = 50;

export function CommandPalette() {
  const [mounted, setMounted] = useState(false); // in DOM (for exit transition)
  const [visible, setVisible] = useState(false); // animated-in state
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // The all-league index (~15k players) is fetched once on first open instead of
  // riding in every page's payload. The layout persists, so it's one fetch/session.
  const [index, setIndex] = useState<PlayerIndexRow[]>([]);
  const indexLoaded = useRef(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setActive(0);
    setMounted(true);
    requestAnimationFrame(() => setVisible(true));
    if (!indexLoaded.current) {
      indexLoaded.current = true;
      fetch("/api/search-index")
        .then((r) => r.json())
        .then((d: PlayerIndexRow[]) => setIndex(d))
        .catch(() => (indexLoaded.current = false)); // let it retry next open
    }
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    closeTimer.current = setTimeout(() => {
      setMounted(false);
      restoreFocusRef.current?.focus?.();
    }, 180);
  }, []);

  // Global ⌘K / Ctrl+K + custom open event.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        mounted ? close() : open();
      }
    }
    function onOpen() {
      open();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, [mounted, open, close]);

  // Lock body scroll + focus input while open.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = prev;
      cancelAnimationFrame(t);
    };
  }, [mounted]);

  const results = useMemo(
    () =>
      fuzzyFilter(
        query,
        index,
        (r) => `${r.player} ${r.team} ${r.pos ?? ""}`,
      ).slice(0, MAX_RESULTS),
    [query, index],
  );

  useEffect(() => {
    if (active >= results.length) setActive(results.length ? results.length - 1 : 0);
  }, [results.length, active]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = useCallback(
    (row: PlayerIndexRow | undefined) => {
      if (!row) return;
      close();
      window.dispatchEvent(
        new CustomEvent(FOCUS_EVENT, { detail: { key: row.key } }),
      );
    },
    [close],
  );

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]?.item);
    } else if (e.key === "Tab") {
      e.preventDefault(); // trap focus — input is the only control
    }
  }

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search players"
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] sm:pt-[16vh]"
    >
      <button
        aria-label="Close search"
        tabIndex={-1}
        onClick={close}
        className={`absolute inset-0 cursor-default bg-black/25 backdrop-blur-md transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className={`relative w-full max-w-2xl overflow-hidden rounded-2xl border border-line-2 bg-panel/95 shadow-2xl shadow-black/60 transition duration-200 ${
          visible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-2 scale-[0.985] opacity-0"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <span className="select-none font-mono text-sm text-volt">⌘K</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search players…"
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent py-4 text-lg text-fg outline-none placeholder:text-faint"
          />
          <kbd className="hidden select-none rounded border border-line-2 px-1.5 py-0.5 font-mono text-[11px] text-muted sm:block">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted">
              No player matches “{query}”.
            </div>
          ) : (
            results.map((res, i) => {
              const r = res.item;
              const isActive = i === active;
              return (
                <button
                  key={r.key}
                  data-idx={i}
                  onClick={() => go(r)}
                  onMouseMove={() => setActive(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isActive ? "bg-volt/10" : "bg-transparent"
                  }`}
                >
                  <span
                    className={`h-8 w-[3px] shrink-0 rounded-full transition-colors ${
                      isActive ? "bg-volt" : "bg-transparent"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-fg">
                      {r.player}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted">
                      {r.team}
                      {r.pos ? ` · ${r.pos}` : ""}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-faint">jump →</span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-2 font-mono text-[11px] text-faint">
          <span>
            {results.length} result{results.length === 1 ? "" : "s"}
          </span>
          <span className="hidden sm:block">↑↓ navigate · ↵ jump to row · esc close</span>
        </div>
      </div>
    </div>
  );
}
