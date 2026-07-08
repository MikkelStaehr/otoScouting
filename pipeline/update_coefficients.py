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
import math
import sqlite3
import statistics
import sys
from pathlib import Path

from registry import REGISTRY

DB = Path(__file__).resolve().parent.parent / "scouting.db"
# Strength = FLOOR + (1-FLOOR) * (ln(median) - ln(min)) / (ln(max) - ln(min)).
# LOG scale because median values span a ~200x range (Iceland ~€0.1m → Premier
# League ~€20m); linear would flatten every development league to the floor.
# The strongest league (a big-5) anchors 1.0; FLOOR is the weakest league's coef.
FLOOR = 0.50
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

    lo_ln, hi_ln = math.log(min(med.values())), math.log(max(med.values()))
    span_ln = hi_ln - lo_ln or 1.0
    for lk, cfg in leagues.items():
        if lk not in med:
            print(f"  ! no Transfermarkt median for {lk} (<{MIN_VALUED} valued players) — left as-is")
            continue
        frac = (math.log(med[lk]) - lo_ln) / span_ln
        cfg["medianValue"] = int(med[lk])
        cfg["strength"] = round(FLOOR + (1 - FLOOR) * frac, 3)
        cfg.pop("avgElo", None)  # drop the stale clubelo artifact

    # Provenance — replace the old clubelo block.
    data.pop("eloSource", None)
    data["strengthSource"] = {
        "provider": "transfermarkt",
        "method": f"log(median market value) mapped to [{FLOOR}, 1.0], strongest league = 1.0",
    }

    REGISTRY.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", "utf-8")

    print(f"Updated {len(med)} coefficients (strongest = 1.0):")
    for lk in sorted(med, key=lambda k: -med[k]):
        print(f"  {lk:<20} median €{med[lk] / 1e6:>5.2f}m   coef {leagues[lk]['strength']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
