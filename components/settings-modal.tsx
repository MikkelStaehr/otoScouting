"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const OPEN_EVENT = "otoscout:open-settings";

interface LeagueStatus {
  league: string;
  players: number;
  teams: number;
  xg: number;
  strength: number | null;
}
interface StatusResponse {
  leagues: LeagueStatus[];
  totals: {
    players: number;
    teams: number;
    leaguesWithPlayers: number;
    leaguesWithTeams: number;
    leaguesTotal: number;
  };
}

type StepStatus = "pending" | "running" | "done" | "failed";
interface IngestStatus {
  running: boolean;
  idle?: boolean;
  mode?: string;
  pid?: number;
  startedAt?: number;
  finishedAt?: number | null;
  phase?: string;
  phaseLabel?: string;
  steps?: { key: string; status: StepStatus; seconds?: number }[];
  leagues?: Record<string, StepStatus>;
  logTail?: string[];
  error?: string | null;
}

const STEP_LABEL: Record<string, string> = {
  coefficients: "Liga-styrke",
  sofascore: "Sofascore (xG)",
  transfermarkt: "Markedsværdier",
  fbref: "FBref (bio)",
  bio: "Højde + fod",
  heatmaps: "Heatmaps",
  formations: "Formationer",
};

/** Dispatch from anywhere (e.g. the header gear) to open Settings. */
export function openSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function fmtDur(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function StatusDot({ status }: { status: StepStatus }) {
  if (status === "done") return <span className="text-volt">✓</span>;
  if (status === "failed") return <span className="text-red-400">✗</span>;
  if (status === "running")
    return <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-volt" />;
  return <span className="inline-block h-2 w-2 rounded-full bg-ink-2" />;
}

export function SettingsModal({ lastUpdated }: { lastUpdated: string | null }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [includeSpatial, setIncludeSpatial] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startErr, setStartErr] = useState<string | null>(null);
  const [ingest, setIngest] = useState<IngestStatus | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const running = starting || !!ingest?.running;

  const open = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMounted(true);
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const close = useCallback(() => {
    // The run is detached — closing is safe, it keeps going and shows again on reopen.
    setVisible(false);
    closeTimer.current = setTimeout(() => setMounted(false), 180);
  }, []);

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

  // Poll the ingest progress file while the panel is open — a run started in a
  // previous open (or a previous session) shows live, and survives closing.
  const loadIngest = useCallback(() => {
    return fetch("/api/ingest/status")
      .then((r) => r.json())
      .then((d: IngestStatus) => setIngest(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let alive = true;
    const tick = () => {
      if (alive) loadIngest();
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [mounted, loadIngest]);

  // Poll the data-loaded status too, so counts climb live as leagues land.
  useEffect(() => {
    if (!mounted) return;
    let alive = true;
    const load = () =>
      fetch("/api/status")
        .then((r) => r.json())
        .then((d: StatusResponse & { error?: string }) => {
          if (alive && !d.error) setStatus(d);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [mounted]);

  async function startIngest(mode: string) {
    setStarting(true);
    setStartErr(null);
    try {
      const res = await fetch("/api/ingest/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const d = await res.json();
      if (!res.ok) setStartErr(d.error ?? "kunne ikke starte");
    } catch (e) {
      setStartErr((e as Error).message);
    } finally {
      setStarting(false);
      loadIngest();
    }
  }

  if (!mounted) return null;

  const steps = ingest?.steps ?? [];
  const doneCount = steps.filter((s) => s.status === "done").length;
  const runCount = steps.filter((s) => s.status === "running").length;
  const pct = steps.length
    ? Math.round(((doneCount + 0.5 * runCount) / steps.length) * 100)
    : running
      ? 4
      : 0;
  const leagues = ingest?.leagues ? Object.entries(ingest.leagues) : [];
  // The per-league grid is FBref-specific — only show it once FBref is actually
  // active, otherwise it's a wall of grey dots during the Sofascore/value phases.
  const fbrefStep = steps.find((s) => s.key === "fbref");
  const showLeagues =
    leagues.length > 0 &&
    (fbrefStep?.status === "running" ||
      fbrefStep?.status === "done" ||
      leagues.some(([, st]) => st !== "pending"));
  const elapsed =
    ingest?.startedAt != null
      ? fmtDur((ingest.finishedAt ?? Date.now()) - ingest.startedAt)
      : null;
  const finishedRecently =
    !running && ingest?.finishedAt != null && Date.now() - ingest.finishedAt < 5 * 60_000;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Indstillinger"
      className="fixed inset-0 z-[55] flex items-start justify-center px-4 pt-[10vh]"
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
        className={`relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line-2 bg-panel/95 shadow-2xl shadow-black/60 transition duration-200 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.985] opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Indstillinger
          </h2>
          <button
            onClick={close}
            className="rounded-md border border-line-2 px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:text-fg"
          >
            esc
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {/* Live data status — which leagues are loaded, counts climb during ingest */}
          {status && (
            <div className="mb-5">
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-medium text-fg">Data indlæst</div>
                <div className="font-mono text-[11px] text-muted">
                  <span className="text-fg">{status.totals.leaguesWithPlayers}</span>/
                  {status.totals.leaguesTotal} ligaer m. spillere ·{" "}
                  <span className="text-fg">{status.totals.players}</span> spillere
                </div>
              </div>
              <div className="mt-2 max-h-44 divide-y divide-line/40 overflow-y-auto rounded-lg border border-line-2">
                {status.leagues.map((l) => (
                  <div
                    key={l.league}
                    className="flex items-center justify-between px-3 py-1.5 text-xs"
                  >
                    <span className={l.players > 0 ? "text-fg" : "text-faint"}>
                      {l.league}
                    </span>
                    <span className="flex items-center gap-3 font-mono text-[11px]">
                      <span
                        className={l.players > 0 ? "text-fg" : "text-faint"}
                        title="spillere (FBref)"
                      >
                        {l.players || "—"} sp
                      </span>
                      <span className="text-muted" title="hold (Sofascore)">
                        {l.teams || "—"} h
                      </span>
                      <span
                        className={l.xg > 0 ? "text-volt" : "text-faint"}
                        title="xG-dækning"
                      >
                        {l.xg > 0 ? "xG" : "–"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-baseline justify-between">
            <div className="text-sm font-medium text-fg">Opdater data</div>
            <span className="font-mono text-[10px] text-faint">
              sidst: {lastUpdated ? lastUpdated.replace("T", " ").slice(0, 16) : "—"}
            </span>
          </div>

          {/* ── Live progress (while a run is going, or just finished) ── */}
          {(running || finishedRecently) && ingest && (
            <div className="mt-3 rounded-xl border border-line-2 bg-ink/30 p-4">
              <div className="flex items-baseline justify-between">
                <span
                  className={`font-mono text-[11px] ${
                    ingest.error ? "text-red-400" : running ? "text-volt" : "text-muted"
                  }`}
                >
                  {ingest.error
                    ? `Fejl: ${ingest.error}`
                    : running
                      ? ingest.phaseLabel || "Arbejder…"
                      : "Færdig ✓"}
                </span>
                {elapsed && <span className="font-mono text-[10px] text-faint">{elapsed}</span>}
              </div>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    ingest.error ? "bg-red-400" : "bg-volt"
                  } ${running ? "animate-pulse" : ""}`}
                  style={{ width: `${Math.max(pct, running ? 4 : 0)}%` }}
                />
              </div>

              {/* Step ledger */}
              {steps.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {steps.map((s) => (
                    <span
                      key={s.key}
                      className="flex items-center gap-1.5 font-mono text-[11px] text-muted"
                    >
                      <StatusDot status={s.status} />
                      {STEP_LABEL[s.key] ?? s.key}
                      {s.seconds != null && (
                        <span className="text-faint">{s.seconds}s</span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* Per-league FBref grid (with retry on the failed ones) */}
              {showLeagues && (
                <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-line/60 p-2">
                  <div className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-faint">
                    FBref pr. liga
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {leagues.map(([key, st]) => (
                      <span
                        key={key}
                        className="flex items-center justify-between gap-1 font-mono text-[10px]"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <StatusDot status={st} />
                          <span className={st === "failed" ? "text-red-400" : "text-muted"}>
                            {key}
                          </span>
                        </span>
                        {st === "failed" && !running && (
                          <button
                            onClick={() => startIngest(`league:${key}`)}
                            className="shrink-0 text-volt hover:underline"
                          >
                            igen
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Log tail */}
              {ingest.logTail && ingest.logTail.length > 0 && (
                <pre className="mt-3 max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-faint">
                  {ingest.logTail.slice(-8).join("\n")}
                </pre>
              )}

              {running && (
                <p className="mt-2 font-mono text-[10px] text-faint">
                  Kører i baggrunden — du kan lukke vinduet, den fortsætter.
                </p>
              )}
            </div>
          )}

          {/* ── Triggers (hidden while a run is live) ── */}
          {!running && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => startIngest(includeSpatial ? "all-spatial" : "all")}
                  className="flex-1 rounded-lg bg-volt px-3 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
                >
                  ⟳ Opdater alt
                </button>
                <button
                  onClick={() => startIngest("sofascore")}
                  className="rounded-lg border border-line-2 px-3 py-2.5 text-xs font-medium text-muted transition-colors hover:text-fg"
                  title="Kun Sofascore — xG / form, hurtigst"
                >
                  Kun form/xG
                </button>
                <button
                  onClick={() => startIngest("tm")}
                  className="rounded-lg border border-line-2 px-3 py-2.5 text-xs font-medium text-muted transition-colors hover:text-fg"
                  title="Kun Transfermarkt markedsværdier"
                >
                  Kun værdier
                </button>
                <button
                  onClick={() => startIngest("bio")}
                  className="rounded-lg border border-line-2 px-3 py-2.5 text-xs font-medium text-muted transition-colors hover:text-fg"
                  title="Højde + fod fra Sofascore (engangs-backfill, ~1 t; derefter hurtigt)"
                >
                  Kun højde
                </button>
              </div>

              <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={includeSpatial}
                  onChange={(e) => setIncludeSpatial(e.target.checked)}
                  className="mt-0.5 accent-volt"
                />
                <span>
                  Inkl. heatmaps + formationer —{" "}
                  <span className="text-faint">
                    to browser-scrapes, ~25 min hver. Uden dette tager “alt” ~10-15 min.
                  </span>
                </span>
              </label>

              <p className="mt-2 font-mono text-[10px] text-faint">
                Forrige hentning gemmes som snapshot (Δ-sammenligning). Fejler en liga,
                vises den ⚠️ ovenfor med “igen”.
              </p>

              {startErr && (
                <p className="mt-2 font-mono text-[11px] text-red-400">Fejl: {startErr}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
