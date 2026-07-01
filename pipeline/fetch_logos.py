#!/usr/bin/env python
"""Download every team's Sofascore crest and self-host it — 100% coverage, since
every team in scouting.db has a sofascore_team_id.

Sofascore's image endpoint is Cloudflare-protected, so we fetch the bytes through
a real browser (which passes the challenge), save them to
public/logos/sofascore/{id}.png, and write config/team-logos.json mapping each
normalised team name (FBref + Sofascore spellings) to its Sofascore id.
lib/team-logos.ts then serves the local file. Re-runs skip crests already on disk.

  python pipeline/fetch_logos.py
"""

from __future__ import annotations

import base64
import json
import re
import sqlite3
import sys
import unicodedata
from pathlib import Path

from botasaurus.browser import browser

ROOT = Path(__file__).resolve().parent.parent
LOGO_DIR = ROOT / "public" / "logos" / "sofascore"
OUT = ROOT / "config" / "team-logos.json"


# FBref uses short/abbreviated names for a handful of clubs that don't token-match
# the Sofascore full name — pin them by id (norm(FBref name) -> sofascore_team_id).
FBREF_ALIAS: dict[str, int] = {
    "rz pellets wac": 2076,        # Wolfsberger AC
    "qpr": 1,                      # Queens Park Rangers
    "kups": 2244,                  # Kuopion Palloseura
    "tps": 2254,                   # Turun Palloseura
    "btsv": 2557,                  # Eintracht Braunschweig
    "aalesund": 677,              # Aalesunds FK
    "vit guimaraes": 3009,         # Vitória SC (Guimarães)
    "hearts": 2353,                # Heart of Midlothian
    "djurgarden": 1759,            # Djurgårdens IF
    "halmstad": 1767,              # Halmstads BK
}


def norm(team: str) -> str:
    """Mirror lib/team-logos.ts norm() so keys match at lookup time."""
    t = team.lower().replace("ø", "o").replace("æ", "ae").replace("å", "a")
    t = "".join(c for c in unicodedata.normalize("NFD", t) if not unicodedata.combining(c))
    t = re.sub(r"[^a-z\s]", " ", t)
    t = re.sub(r"\b(fc|if|bk|sk|ik|ob|ff|boldklub|fodbold)\b", " ", t)
    t = t.replace("kobenhavn", "copenhagen")
    return re.sub(r"\s+", " ", t).strip()


_FETCH_JS = (
    'return fetch("https://api.sofascore.com/api/v1/team/{id}/image")'
    '.then(function(r){{return r.ok?r.blob():"x";}})'
    '.then(function(b){{return (typeof b==="string")?b:'
    "new Promise(function(res){{var fr=new FileReader();"
    "fr.onloadend=function(){{res(fr.result);}};fr.readAsDataURL(b);}});}});"
)


@browser(headless=True, block_images_and_css=True, output=None, create_error_logs=False)
def download(driver, ids):
    driver.get("https://www.sofascore.com/")  # pass Cloudflare once, reuse cookies
    got = 0
    for tid in ids:
        try:
            b64 = driver.run_js(_FETCH_JS.format(id=tid))
        except Exception:
            b64 = None
        if isinstance(b64, str) and b64.startswith("data:image"):
            (LOGO_DIR / f"{tid}.png").write_bytes(base64.b64decode(b64.split(",", 1)[1]))
            got += 1
    return got


def best_match(fb_norm: str, cands: list[tuple[int, str, set[str]]]) -> int | None:
    tok = set(fb_norm.split())
    if not tok:
        return None
    for tid, nk, _ in cands:
        if nk == fb_norm:
            return tid
    best, score = None, 0.0
    for tid, _, ctok in cands:
        if not ctok:
            continue
        inter = len(tok & ctok)
        if not inter:
            continue
        s = max(inter / len(tok), inter / len(ctok))
        if s > score:
            best, score = tid, s
    return best if score >= 0.5 else None


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(ROOT / "scouting.db")
    sofas = conn.execute(
        "SELECT league, team, sofascore_team_id FROM sofascore_teams"
    ).fetchall()

    # 1. download crests we don't already have (one browser session)
    ids = sorted({r[2] for r in sofas if r[2]})
    missing = [i for i in ids if not (LOGO_DIR / f"{i}.png").exists()]
    print(f"{len(ids)} teams, {len(missing)} crests to download…", flush=True)
    if missing:
        got = download([missing])  # wrapped list = single session
        print(f"  downloaded {got}", flush=True)

    # 2. name -> id map (Sofascore spellings + fuzzy-matched FBref spellings)
    mapping: dict[str, int] = {}
    per_league: dict[str, list[tuple[int, str, set[str]]]] = {}
    for lg, team, tid in sofas:
        if not tid:
            continue
        nk = norm(team)
        mapping[nk] = tid
        per_league.setdefault(lg, []).append((tid, nk, set(nk.split())))

    unmatched: list[str] = []
    for lg, team in conn.execute("SELECT DISTINCT league, team FROM players"):
        nk = norm(team)
        if nk in mapping:
            continue
        tid = FBREF_ALIAS.get(nk) or best_match(nk, per_league.get(lg, []))
        if tid:
            mapping[nk] = tid
        else:
            unmatched.append(f"{lg}:{team}")
    conn.close()

    OUT.write_text(
        json.dumps(dict(sorted(mapping.items())), indent=0, ensure_ascii=False) + "\n",
        "utf-8",
    )
    on_disk = len(list(LOGO_DIR.glob("*.png")))
    print(f"\n{on_disk} crests on disk · {len(mapping)} name keys -> {OUT}")
    if unmatched:
        print(f"unmatched FBref teams ({len(unmatched)}): {', '.join(unmatched[:15])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
