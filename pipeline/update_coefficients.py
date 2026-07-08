#!/usr/bin/env python
"""Refresh league-strength coefficients in config/leagues.json from Transfermarkt
market values (the `transfermarkt_players` table).

For each league, take the MEDIAN player market value (robust to a few superstars),
then map it onto a mild strength range so the strongest league = 1.0. Writes
`strength` + `medianValue` back per league.

  python pipeline/update_coefficients.py

Why market value, not clubelo Elo: Transfermarkt covers all our leagues (clubelo
is often down and doesn't cover the smallest leagues at all), and median squad
value measures player quality directly — which is exactly what a cross-league
percentile comparison needs. On the 14 leagues where we had real clubelo, the two
correlate strongly (r≈0.84), so this is a faithful, self-contained replacement.

Steepness is a deliberate product choice, tunable via FLOOR/SPAN below: strength =
FLOOR + SPAN * (medianValue / strongest). FLOOR=0.80 keeps the discount mild (the
strongest league 1.0, the weakest ~0.81), matching the original mild philosophy.
Raise SPAN (lower FLOOR) to make strong leagues clearly outrank weak ones.
"""

from __future__ import annotations

import json
import sqlite3
import statistics
import sys
from pathlib import Path

from registry import REGISTRY

DB = Path(__file__).resolve().parent.parent / "scouting.db"
FLOOR = 0.80  # weakest league's coefficient floor
SPAN = 0.20   # FLOOR + SPAN = 1.0 for the strongest
MIN_VALUED = 30  # need this many valued players to trust a league's median


def median_values() -> dict[str, float]:
    """league -> median market value (euros), over valued players in the DB."""
    conn = sqlite3.connect(DB)
    out: dict[str, float] = {}
    for (lk,) in conn.execute("SELECT DISTINCT league FROM transfermarkt_players"):
        vals = [
            r[0]
            for r in conn.execute(
                "SELECT market_value FROM transfermarkt_players "
                "WHERE league = ? AND market_value > 0",
                (lk,),
            )
        ]
        if len(vals) >= MIN_VALUED:
            out[lk] = statistics.median(vals)
    conn.close()
    return out


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    data = json.loads(REGISTRY.read_text("utf-8"))
    leagues = data["leagues"]
    med = median_values()
    if not med:
        print("No Transfermarkt values found — run pipeline/fetch_transfermarkt.py first.")
        return 1

    top = max(med.values())
    for lk, cfg in leagues.items():
        if lk not in med:
            print(f"  ! no Transfermarkt median for {lk} (<{MIN_VALUED} valued players) — left as-is")
            continue
        cfg["medianValue"] = int(med[lk])
        cfg["strength"] = round(FLOOR + SPAN * (med[lk] / top), 3)
        cfg.pop("avgElo", None)  # drop the stale clubelo artifact

    # Provenance — replace the old clubelo block.
    data.pop("eloSource", None)
    data["strengthSource"] = {
        "provider": "transfermarkt",
        "method": f"median player market value per league, mapped to {FLOOR}+{SPAN}*(median/strongest)",
    }

    REGISTRY.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", "utf-8")

    print(f"Updated {len(med)} coefficients (strongest = 1.0):")
    for lk in sorted(med, key=lambda k: -med[k]):
        print(f"  {lk:<20} median €{med[lk] / 1e6:>5.2f}m   coef {leagues[lk]['strength']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
