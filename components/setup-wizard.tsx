"use client";

// First-run setup: shown when the DB is empty. Detects Python + pipeline deps
// (one-click install into a project .venv), lets you pick leagues, then fetches
// core stats (app becomes usable) and the spatial layer (heatmaps + formations)
// in the background. Local tool — the API routes spawn Python on this machine.

import { useEffect, useMemo, useState } from "react";
import { leagueLabel } from "@/lib/league-meta";
import { leagueFlagUrl } from "@/lib/flags";

interface LeagueRow { key: string; label: string; players: number; teams: number }
interface Check {
  python: { found: boolean; exe: string; isVenv: boolean; version: string | null };
  deps: { ok: boolean; error: string | null };
  data: { ready: boolean; players: number };
  leagues: LeagueRow[];
}

const NORDIC = new Set(["DEN", "NOR", "SWE", "FIN", "ISL"]);

async function stream(url: string, body: unknown, onEvent: (e: Record<string, unknown>) => void) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const reader = res.body?.getReader();
  if (!reader) return;
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) if (l.trim()) onEvent(JSON.parse(l));
  }
}

type Step = "loading" | "prereq" | "leagues" | "running" | "hidden";

export function SetupWizard() {
  const [step, setStep] = useState<Step>("loading");
  const [check, setCheck] = useState<Check | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [coreDone, setCoreDone] = useState(false);

  const load = async () => {
    try {
      const c = (await (await fetch("/api/setup/check")).json()) as Check;
      setCheck(c);
      setSel(new Set(c.leagues.map((l) => l.key)));
      if (c.data.ready) setStep("hidden");
      else setStep(c.deps.ok ? "leagues" : "prereq");
    } catch {
      setStep("hidden"); // never block the app on a check failure
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo(() => {
    const nordic: LeagueRow[] = [];
    const euro: LeagueRow[] = [];
    for (const l of check?.leagues ?? []) (NORDIC.has(l.key.slice(0, 3)) ? nordic : euro).push(l);
    return { nordic, euro };
  }, [check]);

  if (step === "loading" || step === "hidden") return null;

  const toggle = (k: string) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  async function install() {
    setBusy(true); setErr(null); setLog("");
    try {
      await stream("/api/setup/install", {}, (e) => {
        setLog(String(e.label ?? "")); setPct(Number(e.pct ?? 0));
        if (e.stage === "error") setErr(String(e.label));
      });
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
    await load(); // re-check; moves to "leagues" if deps now import
  }

  async function runIngest() {
    if (!sel.size) return;
    const leagues = [...sel];
    setStep("running"); setBusy(true); setErr(null); setLog(""); setPct(3); setCoreDone(false);
    try {
      await stream("/api/setup/ingest", { leagues, phase: "core" }, (e) => {
        if (e.label) setLog(String(e.label));
        if (e.pct != null) setPct(Number(e.pct));
        if (e.stage === "error") setErr(String(e.label));
      });
      setCoreDone(true); setPct(100);
      // kick off the spatial layer in the background (fire-and-forget)
      fetch("/api/setup/ingest", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ leagues, phase: "spatial" }),
      }).catch(() => {});
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-ink/80 px-4 py-[6vh] backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-2xl border border-line-2 bg-panel/95 shadow-2xl shadow-black/50">
        <div className="border-b border-line px-6 py-4">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-volt">OtoScout · opsætning</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-fg">Kom i gang</h2>
          <p className="mt-1 font-mono text-[11px] text-muted">Din database er tom — hent data for de ligaer du vil scoute.</p>
        </div>

        <div className="p-6">
          {step === "prereq" && (
            <Prereq check={check!} busy={busy} log={log} pct={pct} err={err} onInstall={install} onRecheck={load} />
          )}

          {step === "leagues" && check && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-faint">Vælg ligaer</span>
                <div className="flex gap-2 font-mono text-[11px]">
                  <button onClick={() => setSel(new Set(check.leagues.map((l) => l.key)))} className="text-muted hover:text-volt">vælg alle</button>
                  <span className="text-line-2">·</span>
                  <button onClick={() => setSel(new Set())} className="text-muted hover:text-volt">ryd</button>
                </div>
              </div>
              {([["Nordisk dybde", groups.nordic], ["Europæiske salgsligaer", groups.euro]] as const).map(([title, rows]) => (
                <div key={title}>
                  <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-volt">{title}</div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {rows.map((l) => (
                      <button key={l.key} onClick={() => toggle(l.key)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${sel.has(l.key) ? "border-volt/50 bg-volt/10" : "border-line-2 hover:border-volt/40"}`}>
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] ${sel.has(l.key) ? "border-volt bg-volt text-ink" : "border-line-2"}`}>{sel.has(l.key) ? "✓" : ""}</span>
                        <Flag lg={l.key} />
                        <span className="flex-1 truncate text-fg">{l.label}</span>
                        {l.players > 0 && <span className="font-mono text-[10px] text-faint">{l.players}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-line pt-4">
                <span className="font-mono text-[11px] text-faint">{sel.size} liga(er) valgt · stats hentes først, heatmaps + formationer bagefter</span>
                <button disabled={!sel.size} onClick={runIngest}
                  className="rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-ink transition-opacity disabled:opacity-30">
                  Hent data →
                </button>
              </div>
            </div>
          )}

          {step === "running" && (
            <div className="space-y-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-2">
                <div className="h-full rounded-full bg-volt transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="rounded-lg border border-line-2 bg-ink/50 px-3 py-2 font-mono text-[11px] text-muted">
                {err ? <span className="text-clay">{err}</span> : log || "starter…"}
              </div>
              {coreDone && !err && (
                <div className="space-y-3 rounded-xl border border-volt/40 bg-volt/10 p-4">
                  <p className="font-mono text-sm text-fg">✓ Kerne-data hentet — appen er klar.</p>
                  <p className="font-mono text-[11px] text-muted">Heatmaps + formationer hentes nu i baggrunden (kan tage op til en time). Du kan bruge appen imens.</p>
                  <button onClick={() => location.reload()} className="rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-ink">Åbn appen →</button>
                </div>
              )}
              {err && (
                <button onClick={() => setStep("leagues")} className="font-mono text-[11px] text-muted hover:text-volt">← tilbage</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Prereq({ check, busy, log, pct, err, onInstall, onRecheck }: {
  check: Check; busy: boolean; log: string; pct: number; err: string | null; onInstall: () => void; onRecheck: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Row ok={check.python.found} label="Python" detail={check.python.found ? `fundet (${check.python.version ?? "?"})` : "ikke fundet på maskinen"} />
        <Row ok={check.deps.ok} label="Pipeline-pakker" detail={check.deps.ok ? "installeret" : "mangler (soccerdata · ScraperFC · botasaurus)"} />
      </div>

      {!check.python.found ? (
        <div className="rounded-lg border border-line-2 bg-ink/50 p-4 font-mono text-[11px] leading-relaxed text-muted">
          Python blev ikke fundet. Installér Python 3 (python.org) og klik “tjek igen”.
          <br />Har du Python et andet sted, kan du sætte <span className="text-fg">OTOSCOUT_PYTHON</span> til stien.
          <button onClick={onRecheck} className="mt-2 block rounded border border-line-2 px-2 py-1 text-muted hover:text-volt">tjek igen</button>
        </div>
      ) : (
        <>
          {busy ? (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-2">
                <div className="h-full rounded-full bg-volt transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="rounded-lg border border-line-2 bg-ink/50 px-3 py-2 font-mono text-[11px] text-muted">{err ? <span className="text-clay">{err}</span> : log || "installerer…"}</div>
            </>
          ) : (
            <div className="flex items-center justify-between border-t border-line pt-4">
              <span className="font-mono text-[11px] text-faint">Opretter et .venv i projektet og installerer pipeline-pakkerne (ét klik).</span>
              <button onClick={onInstall} className="rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-ink">Installér miljø</button>
            </div>
          )}
          {err && !busy && <button onClick={onRecheck} className="font-mono text-[11px] text-muted hover:text-volt">tjek igen</button>}
        </>
      )}
    </div>
  );
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-sm">
      <span className={ok ? "text-[rgba(77,124,90,1)]" : "text-clay"}>{ok ? "✓" : "○"}</span>
      <span className="text-fg">{label}</span>
      <span className="text-faint">— {detail}</span>
    </div>
  );
}

function Flag({ lg }: { lg: string }) {
  const url = leagueFlagUrl(lg);
  if (!url) return <span className="inline-block h-2.5 w-3.5 shrink-0" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="inline-block h-2.5 w-auto shrink-0 rounded-[1px]" />;
}
