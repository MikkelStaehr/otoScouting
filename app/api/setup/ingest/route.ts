// Run the ingest pipeline for the leagues the user picked, in one of two phases:
//   core    — coefficients + Sofascore + FBref (stats; app becomes usable)
//   spatial — season heatmaps + team formations (slow browser scrapes)
// Streams ingest.py's stdout back as newline-delimited JSON progress.

import { spawn } from "node:child_process";
import { resolvePython } from "@/lib/python";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  leagues?: string[];
  phase?: "core" | "spatial";
}

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* defaults */
  }
  const leagues = (body.leagues ?? []).filter((s) => typeof s === "string" && s);
  const phase = body.phase === "spatial" ? "spatial" : "core";
  if (!leagues.length) {
    return Response.json({ error: "no leagues selected" }, { status: 400 });
  }

  const py = resolvePython();
  const args = ["pipeline/ingest.py", "--leagues", leagues.join(",")];
  args.push(phase === "spatial" ? "--spatial-only" : "--no-spatial");

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      // Guarded: if the client navigates away (e.g. "open the app" mid-spatial),
      // the controller is closed but the child keeps running server-side.
      const send = (e: Record<string, unknown>) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* stream closed — ignore */
        }
      };

      let tail = "";
      let child;
      try {
        child = spawn(py.exe, args, { cwd: process.cwd() });
      } catch (e) {
        send({ stage: "error", label: (e as Error).message, pct: 100 });
        controller.close();
        return;
      }
      send({ stage: "start", label: `${phase === "spatial" ? "Heatmaps + formationer" : "Henter stats"} · ${leagues.length} liga(er)…`, pct: 3 });

      const feed = (d: Buffer) => {
        const text = d.toString();
        tail = (tail + text).slice(-2000);
        for (const raw of text.split(/\r?\n/)) {
          const l = raw.trim();
          if (!l) continue;
          // ingest.py prints "[LEAGUE] …" and "  stored N …" lines — surface them.
          send({ stage: "log", label: l.slice(0, 160) });
        }
      };
      child.stdout.on("data", feed);
      child.stderr.on("data", feed);
      child.on("error", (e) => {
        send({ stage: "error", label: e.message, pct: 100 });
        controller.close();
      });
      child.on("close", (code) => {
        if (code === 0) send({ stage: "done", label: phase === "spatial" ? "Spatial data hentet" : "Stats hentet — appen er klar", pct: 100 });
        else send({ stage: "error", label: tail.trim().split("\n").slice(-2).join(" ") || `exit ${code}`, pct: 100 });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
