#!/usr/bin/env python
"""Generate config/team-logos.json — normalised team name -> ESPN crest id.

For each league with an `espn` code in the registry, pull ESPN's team list and
match every team name we actually store (FBref + Sofascore spellings) to an ESPN
id by normalised-name overlap. lib/team-logos.ts reads the JSON and keeps norm().

  python pipeline/fetch_logos.py

ESPN's soccer coverage is partial (no Poland/Croatia/Czech/Finland/Iceland right
now); unmatched teams simply get no crest.
"""

from __future__ import annotations

import json
import re
import sqlite3
import sys
import unicodedata
import urllib.request
from pathlib import Path

from registry import load_leagues

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "config" / "team-logos.json"
ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer/{code}/teams"


def norm(team: str) -> str:
    """Mirror lib/team-logos.ts norm() exactly so keys match at lookup time."""
    t = team.lower().replace("ø", "o").replace("æ", "ae").replace("å", "a")
    t = "".join(c for c in unicodedata.normalize("NFD", t) if not unicodedata.combining(c))
    t = re.sub(r"[^a-z\s]", " ", t)
    t = re.sub(r"\b(fc|if|bk|sk|ik|ob|ff|boldklub|fodbold)\b", " ", t)
    t = t.replace("kobenhavn", "copenhagen")
    return re.sub(r"\s+", " ", t).strip()


def fetch_espn(code: str) -> list[tuple[int, list[str]]]:
    """(espn id, [name variants]) for a league, or [] if ESPN lacks it."""
    try:
        with urllib.request.urlopen(ESPN.format(code=code), timeout=25) as r:
            d = json.loads(r.read().decode("utf-8"))
        teams = d["sports"][0]["leagues"][0]["teams"]
    except Exception:
        return []
    out = []
    for t in teams:
        tt = t["team"]
        variants = {tt.get(k, "") for k in ("displayName", "shortDisplayName", "name", "location")}
        out.append((int(tt["id"]), [v for v in variants if v]))
    return out


def best_match(db_norm: str, espn: list[tuple[int, set[str], set[str]]]) -> int | None:
    """Exact normalised variant, else strongest token overlap."""
    db_tok = set(db_norm.split())
    if not db_tok:
        return None
    for eid, variants, _ in espn:
        if db_norm in variants:
            return eid
    best, best_score = None, 0.0
    for eid, _, tokens in espn:
        if not tokens:
            continue
        inter = len(db_tok & tokens)
        if not inter:
            continue
        # subset either way (e.g. "ajax" ⊆ "ajax amsterdam") or high Jaccard
        score = max(inter / len(db_tok), inter / len(tokens))
        if score > best_score:
            best, best_score = eid, score
    return best if best_score >= 0.5 else None


def db_team_names(conn: sqlite3.Connection, league: str) -> set[str]:
    names: set[str] = set()
    for tbl, col in (("sofascore_teams", "team"), ("players", "team")):
        try:
            for (n,) in conn.execute(f"SELECT DISTINCT {col} FROM {tbl} WHERE league=?", (league,)):
                if n:
                    names.add(n)
        except sqlite3.OperationalError:
            pass
    return names


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    leagues = load_leagues()
    conn = sqlite3.connect(ROOT / "scouting.db")
    mapping: dict[str, int] = {}
    print("Building team-logos.json…")
    for lk, cfg in leagues.items():
        code = cfg.get("espn")
        if not code:
            continue
        raw = fetch_espn(code)
        if not raw:
            print(f"  {lk:<20} ESPN '{code}' — no data (skipped)")
            continue
        espn = [(eid, {norm(v) for v in vs}, set(norm(" ".join(vs)).split())) for eid, vs in raw]
        # ESPN's own spellings resolve too
        for eid, variants, _ in espn:
            for v in variants:
                mapping.setdefault(v, eid)
        names = db_team_names(conn, lk)
        matched = 0
        unmatched = []
        for name in names:
            nk = norm(name)
            eid = best_match(nk, espn)
            if eid:
                mapping[nk] = eid
                matched += 1
            else:
                unmatched.append(name)
        tag = f"{matched}/{len(names)}"
        print(f"  {lk:<20} ESPN '{code}' — {tag} matched" + (f"  ! {unmatched}" if unmatched else ""))
    conn.close()

    OUT.write_text(json.dumps(dict(sorted(mapping.items())), indent=0, ensure_ascii=False) + "\n", "utf-8")
    print(f"\nWrote {len(mapping)} keys -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
