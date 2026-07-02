// Setup wizard status: is Python present, are the pipeline deps importable, and is
// the DB already populated? Plus the league registry with current row counts.

import { spawn } from "node:child_process";
import { resolvePython } from "@/lib/python";
import { getLeagueStatus } from "@/lib/status";
import { leagueLabel } from "@/lib/league-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function run(exe: string, args: string[], timeoutMs = 15000): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    let out = "";
    let done = false;
    const finish = (code: number) => {
      if (!done) {
        done = true;
        resolve({ code, out: out.trim() });
      }
    };
    try {
      const child = spawn(exe, args, { cwd: process.cwd() });
      const t = setTimeout(() => {
        child.kill();
        finish(124);
      }, timeoutMs);
      child.stdout.on("data", (d) => (out += d.toString()));
      child.stderr.on("data", (d) => (out += d.toString()));
      child.on("error", () => { clearTimeout(t); finish(127); });
      child.on("close", (code) => { clearTimeout(t); finish(code ?? 1); });
    } catch {
      finish(127);
    }
  });
}

export async function GET() {
  const py = resolvePython();
  const ver = await run(py.exe, ["--version"]);
  const pythonFound = ver.code === 0;
  const version = pythonFound ? ver.out.replace(/^Python\s*/i, "").trim() : null;

  let depsOk = false;
  let depsError: string | null = "python ikke fundet";
  if (pythonFound) {
    const dep = await run(py.exe, ["-c", "import soccerdata, ScraperFC, botasaurus"]);
    depsOk = dep.code === 0;
    depsError = depsOk ? null : (dep.out.split("\n").pop() || "import fejlede");
  }

  const status = getLeagueStatus();
  const leagues = status.leagues.map((l) => ({
    key: l.league,
    label: leagueLabel(l.league),
    players: l.players,
    teams: l.teams,
  }));

  return Response.json({
    python: { found: pythonFound, exe: py.exe, isVenv: py.isVenv, source: py.source, version },
    deps: { ok: depsOk, error: depsError },
    data: {
      ready: status.totals.players > 0,
      players: status.totals.players,
      leaguesWithPlayers: status.totals.leaguesWithPlayers,
      leaguesTotal: status.totals.leaguesTotal,
    },
    leagues,
  });
}
