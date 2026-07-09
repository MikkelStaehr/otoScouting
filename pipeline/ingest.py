#!/usr/bin/env python
"""Batch ingestion — the monthly job that fills scouting.db from the registry.

Runs six steps, each isolated so one failure doesn't sink the rest:
  1. clubelo league-strength coefficients (fast)
  2. Sofascore for ALL leagues — one process, one snapshot (keeps Δ-form sane)
  2b. Transfermarkt market values (light club-page scrape, cloudscraper, paced)
  3. FBref per league (slow, ~3-10 min each) — a bad league is logged and skipped
  4. Season heatmaps (browser scrape, ~20-30 min) — per-league resilient
  5. Team formations (browser scrape, ~20-30 min) — per-league resilient

  python pipeline/ingest.py                    # everything (the monthly run)
  python pipeline/ingest.py --sofascore-only   # fast: coeffs + Sofascore only
  python pipeline/ingest.py --tm-only          # just the Transfermarkt values
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
import threading
import time
from pathlib import Path

import progress
from registry import load_leagues

HERE = Path(__file__).resolve().parent
PY = sys.executable


def _run_capture(cmd: list[str], timeout: int | None) -> int:
    """Spawn a sub-script, stream its stdout to the terminal AND the UI log-tail.
    A wall-clock Timer enforces the timeout even on a silent hang (FBref throttles
    without printing), which line-iterating stdout alone would miss."""
    try:
        proc = subprocess.Popen(
            cmd, cwd=HERE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace", bufsize=1,
        )
    except Exception as e:
        progress.log(f"! spawn failed: {e}")
        return 1

    timed_out = {"v": False}
    timer = None
    if timeout:
        def _kill() -> None:
            timed_out["v"] = True
            try:
                proc.kill()
            except Exception:
                pass
        timer = threading.Timer(timeout, _kill)
        timer.start()
    try:
        for line in proc.stdout:  # type: ignore[union-attr]
            line = line.rstrip()
            if line:
                print(line, flush=True)
                progress.log(line)
        proc.wait()
    finally:
        if timer:
            timer.cancel()

    if timed_out["v"]:
        msg = f"! timed out after {timeout}s — skipping"
        print(f"  {msg}", flush=True)
        progress.log(msg)
        return 124
    return proc.returncode


def run(script_args: list[str], label: str, timeout: int | None = None) -> tuple[bool, float]:
    print(f"\n{'=' * 64}\n▶ {label}\n{'=' * 64}", flush=True)
    t = time.time()
    rc = _run_capture([PY, *script_args], timeout)
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
    ap.add_argument("--tm-only", action="store_true", help="only the Transfermarkt market-value scrape")
    ap.add_argument("--no-tm", action="store_true", help="skip the Transfermarkt scrape")
    ap.add_argument("--bio-only", action="store_true", help="only the height/foot backfill")
    ap.add_argument("--no-bio", action="store_true", help="skip the height/foot backfill")
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

    # --bio-only: just the height/foot backfill (standalone / the UI "Kun højde").
    if args.bio_only:
        progress.start("bio", ["bio"], [])
        progress.phase("bio", "Højde + fod (Sofascore)")
        progress.step("bio", "running")
        ok, _ = run(["fetch_bio.py", *db], "Player bio (height/foot)", timeout=7200)
        progress.step("bio", "done" if ok else "failed")
        progress.finish(error=None if ok else "bio")
        return 0 if ok else 1

    only = args.sofascore_only or args.fbref_only or args.spatial_only or args.tm_only

    # Plan which high-level steps will run (mirrors the conditionals below) so the
    # progress UI shows an accurate ledger from the first tick.
    do_spatial = args.spatial_only or (not only and not args.no_spatial)
    do_fbref = not args.sofascore_only and not args.spatial_only
    planned: list[str] = []
    if not args.no_coef and not args.fbref_only and not args.spatial_only:
        planned.append("coefficients")
    if not args.fbref_only and not args.spatial_only:
        planned.append("sofascore")
    if args.tm_only or (not args.sofascore_only and not args.fbref_only
                        and not args.spatial_only and not args.no_tm):
        planned.append("transfermarkt")
    if do_fbref:
        planned.append("fbref")
    if do_spatial:
        planned += ["heatmaps", "formations"]
    mode = ("sofascore" if args.sofascore_only else "tm" if args.tm_only
            else "spatial" if args.spatial_only else "fbref" if args.fbref_only
            else f"league:{keys[0]}" if subset and len(keys) == 1
            else "subset" if subset else "all")
    progress.start(mode, planned, keys if do_fbref else [])

    # 1. league-strength coefficients (unless we're only doing FBref/spatial)
    if not args.no_coef and not args.fbref_only and not args.spatial_only:
        progress.phase("coefficients", "Liga-styrke koefficienter")
        progress.step("coefficients", "running")
        ok, dt = run(["update_coefficients.py"], "clubelo coefficients")
        results["coefficients"] = ok
        progress.step("coefficients", "done" if ok else "failed", dt)

    # 2. Sofascore — one call for the whole set (single Δ snapshot); per league when
    #    a subset is chosen (a first-run wizard pick — no prior snapshot to keep sane).
    if not args.fbref_only and not args.spatial_only:
        progress.phase("sofascore", "Sofascore (xG / rich data)")
        progress.step("sofascore", "running")
        if subset:
            oks = []
            for lk in keys:
                ok, _ = run(["fetch_sofascore.py", "--league", lk, *db], f"Sofascore {lk}")
                results[f"sofascore:{lk}"] = ok
                oks.append(ok)
            progress.step("sofascore", "done" if all(oks) else "failed")
        else:
            ok, dt = run(
                ["fetch_sofascore.py", *db], "Sofascore (all leagues, one snapshot)",
            )
            results["sofascore"] = ok
            progress.step("sofascore", "done" if ok else "failed", dt)

    # 2b. Transfermarkt market values — light club-page scrape (cloudscraper, no
    #     browser, paced). Independent of Sofascore; skipped by --no-tm or the other
    #     *-only modes. Per league on a subset, one process otherwise.
    if args.tm_only or (not args.sofascore_only and not args.fbref_only
                        and not args.spatial_only and not args.no_tm):
        progress.phase("transfermarkt", "Transfermarkt markedsværdier")
        progress.step("transfermarkt", "running")
        if subset:
            oks = []
            for lk in keys:
                ok, _ = run(
                    ["fetch_transfermarkt.py", "--league", lk, *db],
                    f"Transfermarkt {lk}", timeout=600,
                )
                results[f"tm:{lk}"] = ok
                oks.append(ok)
            progress.step("transfermarkt", "done" if all(oks) else "failed")
        else:
            ok, dt = run(
                ["fetch_transfermarkt.py", *db], "Transfermarkt (all leagues)", timeout=3600,
            )
            results["transfermarkt"] = ok
            progress.step("transfermarkt", "done" if ok else "failed", dt)

    # 3. FBref — per league, isolated + time-bounded. FBref throttles/hangs on
    #    big leagues, so cap each attempt and retry the stragglers in later passes
    #    (soccerdata caches successes, so a retry only re-hits what's missing).
    if not args.sofascore_only and not args.spatial_only:
        progress.phase("fbref", "FBref (position / alder / nationalitet)")
        progress.step("fbref", "running")
        pending = list(keys)
        for attempt in range(1, args.fbref_passes + 1):
            if not pending:
                break
            print(f"\n### FBref pass {attempt}/{args.fbref_passes} — {len(pending)} league(s) ###", flush=True)
            still: list[str] = []
            for lk in pending:
                progress.phase("fbref", f"FBref {lk} (pass {attempt}/{args.fbref_passes})")
                progress.league(lk, "running")
                ok, _ = run(
                    ["fetch.py", "--league", lk, "--no-archive", *db],
                    f"FBref {lk} (pass {attempt})",
                    timeout=args.fbref_timeout,
                )
                results[f"fbref:{lk}"] = ok
                # failed-but-more-passes-left → queued (pending); failed-final → failed
                progress.league(lk, "done" if ok else
                                ("pending" if attempt < args.fbref_passes else "failed"))
                if not ok:
                    still.append(lk)
            pending = still
        if pending:
            print(f"\nFBref still missing after {args.fbref_passes} passes: {', '.join(pending)}", flush=True)
        progress.step("fbref", "done" if not pending else "failed")

    # 4-5. Spatial layer (browser scrapes) — season heatmaps + team formations.
    #     Sofascore-derived, so they run after the data is in. Slow (~20-30 min each
    #     across all leagues); both are per-league resilient. Skipped by --no-spatial
    #     or the *-only modes; --spatial-only runs just these.
    if do_spatial:
        for step_key, script, label in (
            ("heatmaps", "fetch_heatmaps.py", "Season heatmaps"),
            ("formations", "fetch_formations.py", "Team formations"),
        ):
            progress.phase(step_key, f"{label} (browser, langsom)")
            progress.step(step_key, "running")
            cmd = [script, *db]
            if args.league:
                cmd += ["--league", args.league]
            ok, dt = run(cmd, f"{label} (browser)", timeout=3600)
            results[label.lower().replace(" ", "_")] = ok
            progress.step(step_key, "done" if ok else "failed", dt)

    dt = time.time() - t0
    print(f"\n{'=' * 64}\nINGEST DONE in {dt / 60:.1f} min\n{'=' * 64}")
    for k, ok in results.items():
        print(f"  {'✓' if ok else '✗'} {k}")
    fails = [k for k, ok in results.items() if not ok]
    if fails:
        print(f"\n{len(fails)} step(s) failed: {', '.join(fails)}")
    progress.finish(error=", ".join(fails) if fails else None)
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
