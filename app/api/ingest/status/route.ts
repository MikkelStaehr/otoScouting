// Read the ingest progress file the Python orchestrator writes. Cross-checks PID
// liveness so a crashed/killed run (which never reached progress.finish) is
// reported as stopped rather than forever "running". Polled by the Settings panel.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_PATH = join(process.cwd(), "pipeline", ".ingest-status.json");

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

export async function GET() {
  if (!existsSync(STATUS_PATH)) return Response.json({ running: false, idle: true });
  try {
    const s = JSON.parse(readFileSync(STATUS_PATH, "utf8"));
    if (s.running && s.pid && !isAlive(s.pid)) {
      return Response.json({
        ...s,
        running: false,
        error: s.error ?? "Processen stoppede uventet",
      });
    }
    return Response.json(s);
  } catch {
    return Response.json({ running: false, idle: true });
  }
}
