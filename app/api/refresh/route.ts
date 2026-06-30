// On-demand data refresh: runs both Python pipelines (which archive the prior
// fetch into history, then re-fetch) and streams stage progress back to the
// Settings modal as newline-delimited JSON. Local tool only — it spawns the
// Python venv on this machine.

import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The venv Python with soccerdata + ScraperFC. Override with OTOSCOUT_PYTHON.
const PYTHON =
  process.env.OTOSCOUT_PYTHON ??
  `${process.env.USERPROFILE ?? process.env.HOME}\\sbspike\\Scripts\\python.exe`;

function runStep(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, args, { cwd: process.cwd() });
    let tail = "";
    const capture = (d: Buffer) => {
      tail = (tail + d.toString()).slice(-800);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.on("error", (e) => reject(new Error(`${args[0]}: ${e.message}`)));
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(tail.trim().split("\n").slice(-3).join(" ") || `exit ${code}`)),
    );
  });
}

export async function POST(req: Request) {
  // Sofascore (fast, reliable, the dynamic xG/rich data) runs by default.
  // FBref (slow headless-Chrome scrape, mostly-static meta) only on request.
  let includeFbref = false;
  try {
    includeFbref = Boolean((await req.json())?.includeFbref);
  } catch {
    /* no body → Sofascore only */
  }

  // FBref season per league (Superliga is cross-year; the Nordic two are
  // calendar-year). Sofascore picks each league's current season itself.
  const FBREF = [
    { league: "DEN-Superliga", season: "2025-2026" },
    { league: "SWE-Allsvenskan", season: "2026" },
    { league: "NOR-Eliteserien", season: "2026" },
  ];

  const steps = [
    {
      stage: "sofascore",
      label: "Henter Sofascore (xG / rich) — alle ligaer…",
      args: ["pipeline/fetch_sofascore.py"],
    },
  ];
  if (includeFbref) {
    for (const { league, season } of FBREF) {
      steps.push({
        stage: "fbref",
        label: `Henter FBref ${league} (langsom)…`,
        args: ["pipeline/fetch.py", "--league", league, "--season", season],
      });
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: Record<string, unknown>) =>
        controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));

      try {
        for (let i = 0; i < steps.length; i++) {
          const pct = Math.round(((i + 0.4) / steps.length) * 90) + 5;
          send({ stage: steps[i]!.stage, label: steps[i]!.label, pct });
          await runStep(steps[i]!.args);
        }
        send({ stage: "done", label: "Færdig — nyt snapshot gemt", pct: 100 });
      } catch (e) {
        send({ stage: "error", label: (e as Error).message, pct: 100 });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
