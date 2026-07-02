// Resolve the Python interpreter for the data pipelines. Prefers the project's
// own .venv (created by the setup wizard) so a fresh clone is self-contained;
// falls back to an env override, a legacy path, then a system launcher. Shared by
// the setup + refresh routes so there's one source of truth (no hardcoded paths).

import { existsSync } from "node:fs";
import { join } from "node:path";

const VENV_WIN = join(process.cwd(), ".venv", "Scripts", "python.exe");
const VENV_POSIX = join(process.cwd(), ".venv", "bin", "python");

export interface PythonInfo {
  exe: string;
  isVenv: boolean;
  source: "venv" | "env" | "legacy" | "system";
}

/** Path the venv's python WILL live at (whether or not it exists yet). */
export function venvPython(): string {
  return process.platform === "win32" ? VENV_WIN : VENV_POSIX;
}

/** The interpreter to run pipelines with. */
export function resolvePython(): PythonInfo {
  if (existsSync(VENV_WIN)) return { exe: VENV_WIN, isVenv: true, source: "venv" };
  if (existsSync(VENV_POSIX)) return { exe: VENV_POSIX, isVenv: true, source: "venv" };
  const env = process.env.OTOSCOUT_PYTHON;
  if (env && existsSync(env)) return { exe: env, isVenv: false, source: "env" };
  const legacy = `${process.env.USERPROFILE ?? process.env.HOME}\\sbspike\\Scripts\\python.exe`;
  if (existsSync(legacy)) return { exe: legacy, isVenv: false, source: "legacy" };
  return { exe: process.platform === "win32" ? "py" : "python3", isVenv: false, source: "system" };
}

/** A SYSTEM interpreter used to create the venv (not the venv itself). */
export function basePython(): string {
  const env = process.env.OTOSCOUT_PYTHON;
  if (env && existsSync(env)) return env;
  return process.platform === "win32" ? "py" : "python3";
}
