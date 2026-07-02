#!/usr/bin/env python
"""Fetch each team's per-match formations for a season and store the distribution.

Formations live in the match lineup (not season aggregates), so we walk the
season's finished matches once and read both teams' formation from
  /event/{id}/lineups   -> {home:{formation}, away:{formation}}
tallying per Sofascore team id. Cloudflare-locked, so we go through a real browser
(same bypass as the heatmaps/crests). One lineup fetch per match covers both teams.

  python pipeline/fetch_formations.py --league POR-PrimeiraLiga
  python pipeline/fetch_formations.py                 # all leagues
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from collections import Counter, defaultdict
from pathlib import Path

from botasaurus.browser import browser

from registry import load_leagues

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = Path(__file__).resolve().parent / "schema_formations.sql"
API = "https://api.sofascore.com/api/v1"


def season_code(s: str) -> str:
    return s.replace("/", "") if "/" in s else s


@browser(headless=True, block_images_and_css=True, output=None, create_error_logs=False)
def fetch_league(driver, job):
    """job = {ut, season} -> {sid, teams:{team_id:{name, formations:{f:n}, matches}}}."""
    driver.get("https://www.sofascore.com/")

    def get(url):
        # .catch so a transient network/Cloudflare blip resolves to null instead of
        # rejecting (an uncaught rejection fails the whole browser task).
        return driver.run_js(
            'return fetch("' + url + '").then(function(r){return r.ok?r.text():null;})'
            '.catch(function(){return null;});'
        )

    st = get(f"{API}/unique-tournament/{job['ut']}/seasons/")
    if not st:
        return {"sid": None, "teams": {}}
    seasons = json.loads(st)["seasons"]
    sid = next((s["id"] for s in seasons if s["year"] == job["season"]), None)
    if sid is None:
        return {"sid": None, "teams": {}}

    # All finished season matches (paged).
    events = []
    for page in range(0, 40):
        txt = get(f"{API}/unique-tournament/{job['ut']}/season/{sid}/events/last/{page}")
        if not txt:
            break
        d = json.loads(txt)
        events += d.get("events", [])
        if not d.get("hasNextPage"):
            break
    events = [e for e in events if e.get("status", {}).get("type") == "finished"]
    print(f"    {len(events)} finished matches", flush=True)

    forms = defaultdict(Counter)  # team_id -> Counter(formation)
    played = Counter()            # team_id -> matches with a formation
    names = {}
    for i, e in enumerate(events):
        h, a = e["homeTeam"], e["awayTeam"]
        names[h["id"]] = h["name"]
        names[a["id"]] = a["name"]
        lt = get(f"{API}/event/{e['id']}/lineups")
        if not lt:
            continue
        try:
            L = json.loads(lt)
        except Exception:
            continue
        for side, tid in (("home", h["id"]), ("away", a["id"])):
            f = (L.get(side) or {}).get("formation")
            if f:
                forms[tid][f] += 1
                played[tid] += 1
        if (i + 1) % 40 == 0:
            print(f"    {i + 1}/{len(events)}…", flush=True)

    teams = {
        tid: {"name": names.get(tid, ""), "formations": dict(c), "matches": played[tid]}
        for tid, c in forms.items()
    }
    return {"sid": sid, "teams": teams}


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", default=None)
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
        print(f"[{lk}] season {cfg['sofascoreSeason']}…", flush=True)
        try:
            out = fetch_league([{"ut": cfg["sofascore"], "season": cfg["sofascoreSeason"]}])[0]
        except Exception as ex:
            print(f"  fetch failed ({str(ex)[:80]}) — skipping", flush=True)
            continue
        teams = (out or {}).get("teams") or {}
        if not teams:
            print("  no formations found — skipping", flush=True)
            continue
        conn.execute("DELETE FROM team_formations WHERE league=? AND season=?", (lk, code))
        rows = []
        for tid, t in teams.items():
            for f, n in t["formations"].items():
                rows.append((lk, code, tid, t["name"], f, n, t["matches"]))
        conn.executemany(
            "INSERT OR REPLACE INTO team_formations "
            "(league, season, team_id, team, formation, n, matches) VALUES (?,?,?,?,?,?,?)",
            rows,
        )
        conn.commit()
        print(f"  stored {len(rows)} rows for {len(teams)} teams", flush=True)
        total += len(rows)

    conn.close()
    print(f"\nDone — {total} formation rows stored.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
