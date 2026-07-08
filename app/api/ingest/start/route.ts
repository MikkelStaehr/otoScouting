// Kick off a data ingest as a DETACHED background process, so it survives a
// closed tab / reload / navigation (a full run is 10-30 min). The Python
// orchestrator owns progress via pipeline/.ingest-status.json; this route only
// spawns it and refuses to start a second run while one is live. Local tool only.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePython } from "@/lib/python";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_PATH = join(process.cwd(), "pipeline", ".ingest-status.json");

// UI mode → ingest.py flags. "all" excludes the two ~25-min browser scrapes by
// default (heatmaps/formations change slowly); the caller opts in with spatial.
function argsFor(mode: string): string[] | null {
  if (mode === "all") return ["--no-spatial"];
  if (mode === "all-spatial") return [];
  if (mode === "sofascore") return ["--sofascore-only"];
  if (mode === "tm") return ["--tm-only"];
  if (mode.startsWith("league:")) {
    const key = mode.slice("league:".length).trim();
    if (!key || !/^[A-Za-z0-9-]+$/.test(key)) return null;
    return ["--league", key, "--no-spatial"];
  }
  return null;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM"; // exists, not ours
  }
}

export async function POST(req: Request) {
  let mode = "all";
  try {
    mode = String((await req.json())?.mode ?? "all");
  } catch {
    /* no body → all */
  }

  const flags = argsFor(mode);
  if (!flags) return Response.json({ error: `ukendt mode: ${mode}` }, { status: 400 });

  // Refuse a second concurrent run.
  if (existsSync(STATUS_PATH)) {
    try {
      const cur = JSON.parse(readFileSync(STATUS_PATH, "utf8"));
      if (cur.running && cur.pid && isAlive(cur.pid)) {
        return Response.json({ error: "En opdatering kører allerede" }, { status: 409 });
      }
    } catch {
      /* unreadable → treat as free */
    }
  }

  const python = resolvePython();
  const child = spawn(python.exe, ["pipeline/ingest.py", ...flags], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  // Stub status immediately so the UI shows "Starter…" before Python's first
  // write — and so a crash-on-import is still visible (running + dead pid).
  try {
    writeFileSync(
      STATUS_PATH,
      JSON.stringify({
        running: true,
        mode,
        pid: child.pid,
        startedAt: Date.now(),
        finishedAt: null,
        phase: "starting",
        phaseLabel: "Starter…",
        steps: [],
        leagues: {},
        logTail: [],
        error: null,
      }),
    );
  } catch {
    /* best-effort */
  }

  return Response.json({ ok: true, pid: child.pid, mode });
}
