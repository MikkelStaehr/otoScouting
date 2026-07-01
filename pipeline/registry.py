"""Shared league registry — the single source of truth for every league.

Both pipelines (fetch.py, fetch_sofascore.py) load their per-league config from
here instead of hard-coding it, so adding a league is one edit in
config/leagues.json. See that file's _comment for the field meanings.
"""

from __future__ import annotations

import json
from pathlib import Path

REGISTRY = Path(__file__).resolve().parent.parent / "config" / "leagues.json"


def load_leagues() -> dict[str, dict]:
    """league key -> its config dict, in registry order."""
    data = json.loads(REGISTRY.read_text("utf-8"))
    return data["leagues"]
