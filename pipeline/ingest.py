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


def run(script_args: list[str], label: str, timeout: int | None = None) -> tuple[bool, float]:
    print(f"\n{'=' * 64}\n▶ {label}\n{'=' * 64}", flush=True)
    t = time.time()
    try:
        rc = subprocess.run([PY, *script_args], cwd=HERE, timeout=timeout).returncode
    except subprocess.TimeoutExpired:
        rc = 124  # FBref hung/throttled — killed, move on (retried in a later pass)
        print(f"  ! timed out after {timeout}s — skipping", flush=True)
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
    ap.add_argument("--fbref-timeout", type=int, default=240,
                    help="per-league FBref timeout in seconds; a hang is skipped and retried")
    ap.add_argument("--fbref-passes", type=int, default=3,
                    help="retry passes over leagues that failed/timed out")
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

    # 3. FBref — per league, isolated + time-bounded. FBref throttles/hangs on
    #    big leagues, so cap each attempt and retry the stragglers in later passes
    #    (soccerdata caches successes, so a retry only re-hits what's missing).
    if not args.sofascore_only:
        pending = list(keys)
        for attempt in range(1, args.fbref_passes + 1):
            if not pending:
                break
            print(f"\n### FBref pass {attempt}/{args.fbref_passes} — {len(pending)} league(s) ###", flush=True)
            still: list[str] = []
            for lk in pending:
                ok, _ = run(
                    ["fetch.py", "--league", lk, "--no-archive", *db],
                    f"FBref {lk} (pass {attempt})",
                    timeout=args.fbref_timeout,
                )
                results[f"fbref:{lk}"] = ok
                if not ok:
                    still.append(lk)
            pending = still
        if pending:
            print(f"\nFBref still missing after {args.fbref_passes} passes: {', '.join(pending)}", flush=True)

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
