#!/usr/bin/env python
"""Backfill player height + preferred foot from Sofascore's player-detail API.

Sofascore carries these only on the per-player endpoint (/api/v1/player/{id}) —
not the season-stats scrape — so it's a per-player pass. But height/foot are static
bio, so it's a one-time backfill (skips ids already in player_bio) plus a cheap
incremental for new players each run. Direct cloudscraper (no browser), paced.
Weight isn't in the API, so it isn't stored.

  python pipeline/fetch_bio.py             # backfill everything missing
  python pipeline/fetch_bio.py --limit 50  # small test batch
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import cloudscraper
import db as _pdb

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = Path(__file__).resolve().parent / "schema_bio.sql"
API = "https://api.sofascore.com/api/v1/player/{}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=str(ROOT / "scouting.db"))
    ap.add_argument("--limit", type=int, default=None, help="only fetch N (for a test)")
    ap.add_argument("--delay", type=float, default=0.3, help="seconds between calls")
    args = ap.parse_args()

    conn = _pdb.connect(args.db)
    conn.executescript(SCHEMA.read_text("utf-8"))
    conn.commit()

    have = {r[0] for r in conn.execute("SELECT player_id FROM player_bio")}
    ids = [r[0] for r in conn.execute("SELECT DISTINCT player_id FROM sofascore_players")]
    todo = [i for i in ids if i not in have]
    if args.limit:
        todo = todo[: args.limit]
    print(f"player_bio: {len(have)} known, {len(todo)} to fetch", flush=True)
    if not todo:
        return 0

    scraper = cloudscraper.create_scraper()
    ok = fail = 0
    for n, pid in enumerate(todo, 1):
        try:
            r = scraper.get(API.format(pid), timeout=20)
            if r.status_code != 200:
                fail += 1
                if r.status_code in (403, 429):
                    # IP throttle — back off hard, then keep going (unfetched ids
                    # just retry on the next run since we only store successes).
                    print(f"  ! {r.status_code} at {pid} — pausing 30s", flush=True)
                    time.sleep(30)
                continue
            p = r.json().get("player", {})
            conn.execute(
                "INSERT OR REPLACE INTO player_bio (player_id, height, foot, fetched_at)"
                " VALUES (?,?,?,datetime('now'))",
                (pid, p.get("height"), p.get("preferredFoot")),
            )
            ok += 1
            if n % 50 == 0:
                conn.commit()
                print(f"  {n}/{len(todo)} · {ok} ok · {fail} fail", flush=True)
        except Exception as e:
            fail += 1
            if fail % 25 == 0:
                print(f"  ! {fail} errors (last: {e})", flush=True)
        time.sleep(args.delay)

    conn.commit()
    print(f"done: {ok} fetched, {fail} failed, {len(todo)} attempted", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
