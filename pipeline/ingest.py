#!/usr/bin/env python
"""Batch ingestion — the monthly job that fills scouting.db from the registry.

Runs three steps, each isolated so one failure doesn't sink the rest:
  1. clubelo league-strength coefficients (fast)
  2. Sofascore for ALL leagues — one process, one snapshot (keeps Δ-form sane)
  3. FBref per league (slow, ~3-10 min each) — a bad league is logged and skipped

  python pipeline/ingest.py                    # everything (the monthly run)
  python pipeline/ingest.py --sofascore-only   # fast: coeffs + Sofascore only
  python pipeline/ingest.py --fbref-only       # just the slow FBref pass
  python pipeline/ingest.py --league NED-Eredivisie   # one league end-to-end

FBref is mostly-static bio (age/pos/nation) → monthly is plenty. Sofascore is the
dynamic layer (xG/form) → run it (or --sofascore-only) as often as you like.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

from registry import load_leagues

HERE = Path(__file__).resolve().parent
PY = sys.executable


def run(script_args: list[str], label: str) -> tuple[bool, float]:
    print(f"\n{'=' * 64}\n▶ {label}\n{'=' * 64}", flush=True)
    t = time.time()
    rc = subprocess.run([PY, *script_args], cwd=HERE).returncode
    dt = time.time() - t
    print(f"{'✓' if rc == 0 else '✗'} {label}  ({dt:.0f}s, exit {rc})", flush=True)
    return rc == 0, dt


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument("--league", default=None, help="restrict to one league key")
    ap.add_argument("--sofascore-only", action="store_true")
    ap.add_argument("--fbref-only", action="store_true")
    ap.add_argument("--no-coef", action="store_true", help="skip clubelo coefficients")
    ap.add_argument("--db", default=None)
    args = ap.parse_args()

    keys = [args.league] if args.league else list(load_leagues())
    db = ["--db", args.db] if args.db else []
    results: dict[str, bool] = {}
    t0 = time.time()

    print(f"Ingesting {len(keys)} league(s): {', '.join(keys)}", flush=True)

    # 1. league-strength coefficients (unless we're only doing FBref)
    if not args.no_coef and not args.fbref_only:
        results["coefficients"], _ = run(["update_coefficients.py"], "clubelo coefficients")

    # 2. Sofascore — one call so the whole table gets a single Δ snapshot
    if not args.fbref_only:
        sofa = ["fetch_sofascore.py", *db]
        if args.league:
            sofa += ["--league", args.league]
        results["sofascore"], _ = run(sofa, "Sofascore (all leagues, one snapshot)")

    # 3. FBref — per league, isolated (slow)
    if not args.sofascore_only:
        for lk in keys:
            ok, _ = run(["fetch.py", "--league", lk, "--no-archive", *db], f"FBref {lk}")
            results[f"fbref:{lk}"] = ok

    dt = time.time() - t0
    print(f"\n{'=' * 64}\nINGEST DONE in {dt / 60:.1f} min\n{'=' * 64}")
    for k, ok in results.items():
        print(f"  {'✓' if ok else '✗'} {k}")
    fails = [k for k, ok in results.items() if not ok]
    if fails:
        print(f"\n{len(fails)} step(s) failed: {', '.join(fails)}")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
