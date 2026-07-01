#!/usr/bin/env python
"""Refresh league-strength coefficients in config/leagues.json from clubelo.com.

For each league in the registry, take the mean club Elo of its clubelo country +
division level, then normalise so the strongest registered league = 1.0 and write
`strength` + `avgElo` back. Run after adding a league (or periodically).

  python pipeline/update_coefficients.py

Elo compares across countries AND divisions natively, so a strong second tier
(e.g. the Championship) can rank above a weaker top flight — which is correct for
player-quality translation. Second-tier leagues set "clubeloLevel": 2 in the
registry (default 1).
"""

from __future__ import annotations

import csv
import io
import json
import sys
import urllib.request
from collections import defaultdict
from datetime import date

from registry import REGISTRY


def fetch_elo() -> dict[tuple[str, str], float]:
    """(country, level) -> mean club Elo, from clubelo's current CSV."""
    url = f"http://api.clubelo.com/{date.today().isoformat()}"
    with urllib.request.urlopen(url, timeout=60) as r:  # noqa: S310 (trusted host)
        rows = list(csv.DictReader(io.StringIO(r.read().decode("utf-8"))))
    tot: dict[tuple[str, str], float] = defaultdict(float)
    n: dict[tuple[str, str], int] = defaultdict(int)
    for row in rows:
        key = (row["Country"], row["Level"])
        try:
            tot[key] += float(row["Elo"])
        except ValueError:
            continue
        n[key] += 1
    return {k: tot[k] / n[k] for k in tot if n[k]}


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    data = json.loads(REGISTRY.read_text("utf-8"))
    leagues = data["leagues"]
    elo = fetch_elo()

    avg: dict[str, float] = {}
    for lk, cfg in leagues.items():
        key = (cfg.get("clubelo"), str(cfg.get("clubeloLevel", 1)))
        if key[0] and key in elo:
            avg[lk] = round(elo[key], 1)
        else:
            print(f"  ! no clubelo data for {lk} (country={key[0]} level={key[1]})")

    if not avg:
        print("No coefficients computed — nothing written.")
        return 1

    top = max(avg.values())
    for lk, a in avg.items():
        leagues[lk]["avgElo"] = a
        leagues[lk]["strength"] = round(a / top, 3)
    data.setdefault("eloSource", {})["date"] = date.today().isoformat()

    REGISTRY.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", "utf-8")

    print(f"\nUpdated {len(avg)} coefficients (strongest = 1.0):")
    for lk in leagues:
        if lk in avg:
            print(f"  {lk:<18} elo {leagues[lk]['avgElo']:<8} coef {leagues[lk]['strength']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
