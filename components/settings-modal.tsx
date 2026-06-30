"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const OPEN_EVENT = "otoscout:open-settings";

/** Dispatch from anywhere (e.g. the header gear) to open Settings. */
export function openSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function SettingsModal({ lastUpdated }: { lastUpdated: string | null }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [running, setRunning] = useState(false);
  const [includeFbref, setIncludeFbref] = useState(false);
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMounted(true);
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const close = useCallback(() => {
    if (running) return; // don't close mid-refresh
    setVisible(false);
    closeTimer.current = setTimeout(() => setMounted(false), 180);
  }, [running]);

  useEffect(() => {
    function onOpen() {
      open();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && mounted) close();
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, mounted]);

  async function refresh() {
    setRunning(true);
    setError(null);
    setPct(2);
    setLabel("Starter…");
    let hadError = false;
    try {
      const res = await fetch("/api/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ includeFbref }),
      });
      if (!res.body) throw new Error("ingen stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as { stage: string; label: string; pct: number };
          setPct(e.pct);
          setLabel(e.label);
          if (e.stage === "error") {
            hadError = true;
            setError(e.label);
          }
        }
      }
    } catch (e) {
      hadError = true;
      setError((e as Error).message);
    }
    setRunning(false);
    if (!hadError) {
      setLabel("Færdig — genindlæser…");
      setTimeout(() => location.reload(), 900);
    }
  }

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Indstillinger"
      className="fixed inset-0 z-[55] flex items-start justify-center px-4 pt-[14vh]"
    >
      <button
        aria-label="Luk"
        tabIndex={-1}
        onClick={close}
        className={`absolute inset-0 cursor-default bg-black/25 backdrop-blur-md transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className={`relative w-full max-w-md overflow-hidden rounded-2xl border border-line-2 bg-panel/95 shadow-2xl shadow-black/60 transition duration-200 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.985] opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Indstillinger
          </h2>
          {!running && (
            <button
              onClick={close}
              className="rounded-md border border-line-2 px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:text-fg"
            >
              esc
            </button>
          )}
        </div>

        <div className="p-5">
          <div className="text-sm font-medium text-fg">Opdater data</div>
          <p className="mt-1 text-xs text-muted">
            Henter Sofascore (xG / rich data) for alle 3 ligaer på ny — typisk
            ~30&nbsp;sek. Forrige hentning gemmes som snapshot, så du har et
            sammenligningsgrundlag.
          </p>
          <p className="mt-2 font-mono text-[11px] text-faint">
            Sidst opdateret: {lastUpdated ? lastUpdated.replace("T", " ") : "—"}
          </p>

          <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={includeFbref}
              disabled={running}
              onChange={(e) => setIncludeFbref(e.target.checked)}
              className="mt-0.5 accent-volt"
            />
            <span>
              Inkl. FBref (position/alder/nationalitet) —{" "}
              <span className="text-faint">langsom, ~10 min for alle 3 ligaer, sjældent nødvendigt</span>
            </span>
          </label>

          <button
            onClick={refresh}
            disabled={running}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-volt px-4 py-2.5 text-sm font-semibold text-ink transition-opacity disabled:opacity-50"
          >
            {running ? "Henter…" : "⟳ Opdater data nu"}
          </button>

          {(running || pct > 0) && (
            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-2">
                <div
                  className={`h-full rounded-full bg-volt transition-all duration-500 ${
                    running ? "animate-pulse" : ""
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p
                className={`mt-2 font-mono text-[11px] ${
                  error ? "text-red-400" : "text-muted"
                }`}
              >
                {error ? `Fejl: ${error}` : label}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
