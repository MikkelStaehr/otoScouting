#!/usr/bin/env python
"""Batch ingestion — the monthly job that fills scouting.db from the registry.

Runs five steps, each isolated so one failure doesn't sink the rest:
  1. clubelo league-strength coefficients (fast)
  2. Sofascore for ALL leagues — one process, one snapshot (keeps Δ-form sane)
  3. FBref per league (slow, ~3-10 min each) — a bad league is logged and skipped
  4. Season heatmaps (browser scrape, ~20-30 min) — per-league resilient
  5. Team formations (browser scrape, ~20-30 min) — per-league resilient

  python pipeline/ingest.py                    # everything (the monthly run)
  python pipeline/ingest.py --sofascore-only   # fast: coeffs + Sofascore only
  python pipeline/ingest.py --fbref-only       # just the slow FBref pass
  python pipeline/ingest.py --spatial-only     # just heatmaps + formations
  python pipeline/ingest.py --no-spatial       # everything except the browser scrapes
  python pipeline/ingest.py --league NED-Eredivisie   # one league end-to-end

All tables are keyed by season, so pointing the registry at a past season and
re-running accumulates seasons side by side — compare across years in the DB.

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
    ap.add_argument("--leagues", default=None, help="comma-separated subset of league keys")
    ap.add_argument("--sofascore-only", action="store_true")
    ap.add_argument("--fbref-only", action="store_true")
    ap.add_argument("--spatial-only", action="store_true",
                    help="only the browser scrapes: heatmaps + formations")
    ap.add_argument("--no-spatial", action="store_true",
                    help="skip the browser scrapes (heatmaps + formations)")
    ap.add_argument("--no-coef", action="store_true", help="skip clubelo coefficients")
    ap.add_argument("--fbref-timeout", type=int, default=240,
                    help="per-league FBref timeout in seconds; a hang is skipped and retried")
    ap.add_argument("--fbref-passes", type=int, default=3,
                    help="retry passes over leagues that failed/timed out")
    ap.add_argument("--db", default=None)
    args = ap.parse_args()

    all_leagues = list(load_leagues())
    if args.leagues:
        want = [k.strip() for k in args.leagues.split(",") if k.strip()]
        keys = [k for k in want if k in all_leagues]
    elif args.league:
        keys = [args.league]
    else:
        keys = all_leagues
    subset = len(keys) < len(all_leagues)  # a chosen subset → Sofascore per league
    db = ["--db", args.db] if args.db else []
    results: dict[str, bool] = {}
    t0 = time.time()

    print(f"Ingesting {len(keys)} league(s): {', '.join(keys)}", flush=True)

    only = args.sofascore_only or args.fbref_only or args.spatial_only

    # 1. league-strength coefficients (unless we're only doing FBref/spatial)
    if not args.no_coef and not args.fbref_only and not args.spatial_only:
        results["coefficients"], _ = run(["update_coefficients.py"], "clubelo coefficients")

    # 2. Sofascore — one call for the whole set (single Δ snapshot); per league when
    #    a subset is chosen (a first-run wizard pick — no prior snapshot to keep sane).
    if not args.fbref_only and not args.spatial_only:
        if subset:
            for lk in keys:
                results[f"sofascore:{lk}"], _ = run(
                    ["fetch_sofascore.py", "--league", lk, *db], f"Sofascore {lk}",
                )
        else:
            results["sofascore"], _ = run(
                ["fetch_sofascore.py", *db], "Sofascore (all leagues, one snapshot)",
            )

    # 3. FBref — per league, isolated + time-bounded. FBref throttles/hangs on
    #    big leagues, so cap each attempt and retry the stragglers in later passes
    #    (soccerdata caches successes, so a retry only re-hits what's missing).
    if not args.sofascore_only and not args.spatial_only:
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

    # 4-5. Spatial layer (browser scrapes) — season heatmaps + team formations.
    #     Sofascore-derived, so they run after the data is in. Slow (~20-30 min each
    #     across all leagues); both are per-league resilient. Skipped by --no-spatial
    #     or the *-only modes; --spatial-only runs just these.
    do_spatial = args.spatial_only or (not only and not args.no_spatial)
    if do_spatial:
        for script, label in (("fetch_heatmaps.py", "Season heatmaps"),
                              ("fetch_formations.py", "Team formations")):
            cmd = [script, *db]
            if args.league:
                cmd += ["--league", args.league]
            results[label.lower().replace(" ", "_")], _ = run(cmd, f"{label} (browser)", timeout=3600)

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
