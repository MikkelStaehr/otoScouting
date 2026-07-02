// One-click environment setup: create the project .venv (if missing) and pip
// install the pipeline requirements. Streams progress as newline-delimited JSON.
// Local tool only — spawns Python on this machine.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { basePython, venvPython } from "@/lib/python";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function runStep(exe: string, args: string[], onLine: (s: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let tail = "";
    let child;
    try {
      child = spawn(exe, args, { cwd: process.cwd() });
    } catch (e) {
      reject(new Error((e as Error).message));
      return;
    }
    const feed = (d: Buffer) => {
      const s = d.toString();
      tail = (tail + s).slice(-1200);
      // emit the last non-empty line for a live tail
      const last = s.split(/\r?\n/).filter(Boolean).pop();
      if (last) onLine(last.slice(0, 160));
    };
    child.stdout.on("data", feed);
    child.stderr.on("data", feed);
    child.on("error", (e) => reject(new Error(`${exe}: ${e.message}`)));
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(tail.trim().split("\n").slice(-2).join(" ") || `exit ${code}`)),
    );
  });
}

export async function POST() {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: Record<string, unknown>) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      const line = (stage: string, pct: number) => (s: string) => send({ stage, label: s, pct });

      try {
        const vpy = venvPython();
        if (!existsSync(vpy)) {
          send({ stage: "venv", label: "Opretter virtuelt miljø (.venv)…", pct: 10 });
          await runStep(basePython(), ["-m", "venv", ".venv"], line("venv", 15));
        }
        send({ stage: "pip", label: "Opgraderer pip…", pct: 25 });
        await runStep(vpy, ["-m", "pip", "install", "--upgrade", "pip"], line("pip", 30));

        send({ stage: "deps", label: "Installerer pakker (kan tage et par minutter)…", pct: 40 });
        await runStep(vpy, ["-m", "pip", "install", "-r", "pipeline/requirements.txt"], line("deps", 70));

        send({ stage: "verify", label: "Verificerer…", pct: 92 });
        await runStep(vpy, ["-c", "import soccerdata, ScraperFC, botasaurus"], line("verify", 95));

        send({ stage: "done", label: "Miljø klar", pct: 100 });
      } catch (e) {
        send({ stage: "error", label: (e as Error).message, pct: 100 });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
