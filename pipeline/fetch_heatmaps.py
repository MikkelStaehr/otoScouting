#!/usr/bin/env python
"""Fetch Sofascore SEASON action heatmaps per player and store a small binned grid.

Sofascore aggregates a player's whole-season heatmap at
  /player/{id}/unique-tournament/{ut}/season/{sid}/heatmap
returning ~1000-2000 {x,y,count} action cells. That endpoint is Cloudflare-locked
to plain requests, so we fetch through a real browser (like the crests). We bin
the cells into a GRID_W x GRID_H grid (row-major, normalised 0-1) and store it —
tiny, ready to draw as a pitch heatmap or compare spatially.

  python pipeline/fetch_heatmaps.py --league DEN-Superliga
  python pipeline/fetch_heatmaps.py                 # all leagues
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

from botasaurus.browser import browser

from registry import load_leagues

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = Path(__file__).resolve().parent / "schema_heatmaps.sql"
API = "https://api.sofascore.com/api/v1"
GRID_W, GRID_H = 12, 8
MIN_MINUTES = 300


def season_code(s: str) -> str:
    return s.replace("/", "") if "/" in s else s


def bin_grid(points: list[dict]) -> list[float]:
    g = [0.0] * (GRID_W * GRID_H)
    for p in points:
        x, y, c = p.get("x", 0), p.get("y", 0), p.get("count", 1)
        cx = min(int(x / 100 * GRID_W), GRID_W - 1)
        cy = min(int(y / 100 * GRID_H), GRID_H - 1)
        g[cy * GRID_W + cx] += c
    m = max(g) or 1.0
    return [round(v / m, 3) for v in g]


@browser(headless=True, block_images_and_css=True, output=None, create_error_logs=False)
def fetch_league(driver, job):
    """job = {ut, season, players:[(pid,minutes)]} -> {sid, rows:[(pid,grid,n,matches)]}."""
    driver.get("https://www.sofascore.com/")

    def get(url):
        return driver.run_js(
            'return fetch("' + url + '").then(function(r){return r.ok?r.text():null;})'
            '.catch(function(){return null;});'
        )

    st = get(f"{API}/unique-tournament/{job['ut']}/seasons/")
    if not st:
        return {"sid": None, "rows": []}
    seasons = json.loads(st)["seasons"]
    sid = next((s["id"] for s in seasons if s["year"] == job["season"]), None)
    if sid is None:
        return {"sid": None, "rows": []}

    rows = []
    for i, (pid, _mins) in enumerate(job["players"]):
        try:
            txt = get(f"{API}/player/{pid}/unique-tournament/{job['ut']}/season/{sid}/heatmap")
            if not txt:
                continue
            pts = json.loads(txt).get("points", [])
            if not pts:
                continue
            d = json.loads(txt)
            rows.append((pid, json.dumps(bin_grid(pts)), len(pts), d.get("matches")))
        except Exception:
            continue
        if (i + 1) % 50 == 0:
            print(f"    {i + 1}/{len(job['players'])}…", flush=True)
    return {"sid": sid, "rows": rows}


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", default=None)
    ap.add_argument("--min-minutes", type=int, default=MIN_MINUTES)
    ap.add_argument("--db", default=str(ROOT / "scouting.db"))
    args = ap.parse_args()

    leagues = load_leagues()
    keys = [args.league] if args.league else list(leagues)
    conn = sqlite3.connect(args.db)
    conn.executescript(SCHEMA.read_text("utf-8"))

    total = 0
    for lk in keys:
        cfg = leagues[lk]
        code = season_code(cfg["sofascoreSeason"])
        players = conn.execute(
            "SELECT player_id, minutes FROM sofascore_players "
            "WHERE league=? AND season=? AND minutes>=? ORDER BY minutes DESC",
            (lk, code, args.min_minutes),
        ).fetchall()
        if not players:
            print(f"[{lk}] no players (>= {args.min_minutes} min) — skipping")
            continue
        print(f"[{lk}] {len(players)} players (season {cfg['sofascoreSeason']})…", flush=True)
        try:
            out = fetch_league([{"ut": cfg["sofascore"], "season": cfg["sofascoreSeason"], "players": players}])[0]
        except Exception as ex:
            print(f"  fetch failed ({str(ex)[:80]}) — skipping", flush=True)
            continue
        rows = (out or {}).get("rows") or []
        if not rows:
            print("  no heatmaps — skipping", flush=True)
            continue
        conn.execute("DELETE FROM player_heatmaps WHERE league=? AND season=?", (lk, code))
        conn.executemany(
            "INSERT OR REPLACE INTO player_heatmaps "
            "(league, season, player_id, grid_w, grid_h, grid, n_points, matches) "
            "VALUES (?,?,?,?,?,?,?,?)",
            [(lk, code, pid, GRID_W, GRID_H, grid, n, m) for pid, grid, n, m in rows],
        )
        conn.commit()
        print(f"  stored {len(rows)} heatmaps", flush=True)
        total += len(rows)

    conn.close()
    print(f"\nDone — {total} heatmaps stored.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
