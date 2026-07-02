"""ESPN crest fallback. Sofascore is the primary crest source (fetch_logos.py), but
some leagues aren't on Sofascore yet (blocked) or Sofascore misses a team. ESPN's
open API is independent and Cloudflare-free, so for every registry league with an
`espn` code we download its crests to public/logos/espn/{espnId}.png and map every
normalised FBref team name to its ESPN id in config/team-logos-espn.json.

`lib/team-logos.ts` tries the Sofascore map first, then this ESPN map — so ESPN is
a pure fallback, never overriding a self-hosted Sofascore crest.

  python pipeline/fetch_logos_espn.py                 # all registry leagues w/ espn code
  python pipeline/fetch_logos_espn.py --leagues FRA-Ligue2,ESP-Segunda
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import ssl
import urllib.request
from pathlib import Path

from fetch_logos import norm, best_match  # reuse the exact runtime norm + matcher
from registry import load_leagues

ROOT = Path(__file__).resolve().parent.parent
LOGO_DIR = ROOT / "public" / "logos" / "espn"
OUT = ROOT / "config" / "team-logos-espn.json"
API = "https://site.api.espn.com/apis/site/v2/sports/soccer/{code}/teams"
CTX = ssl.create_default_context()


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20, context=CTX) as r:
        return r.read()


def espn_teams(code: str) -> list[dict]:
    """[{id, names:set, tokens:set, logo}] for a league, or [] if ESPN lacks it."""
    try:
        data = json.loads(get(API.format(code=code)))
        raw = data["sports"][0]["leagues"][0]["teams"]
    except Exception as e:
        print(f"  ! ESPN {code}: {type(e).__name__} — skipping", flush=True)
        return []
    out = []
    for entry in raw:
        t = entry["team"]
        logos = t.get("logos") or []
        if not logos:
            continue
        names = {
            t.get("displayName", ""), t.get("shortDisplayName", ""),
            t.get("name", ""), t.get("location", ""), t.get("nickname", ""),
        }
        names = {n for n in names if n}
        tokens: set[str] = set()
        for n in names:
            tokens |= set(norm(n).split())
        out.append({
            "id": str(t["id"]), "names": names, "tokens": tokens,
            "logo": logos[0]["href"],
        })
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--leagues", default="")
    args = ap.parse_args()

    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    reg = load_leagues()
    picked = args.leagues.split(",") if args.leagues else list(reg)

    conn = sqlite3.connect(ROOT / "scouting.db")
    mapping: dict[str, str] = {}
    if OUT.exists():
        try:
            mapping = json.loads(OUT.read_text("utf-8"))
        except Exception:
            mapping = {}

    downloaded = 0
    total_matched = 0
    unmatched: list[str] = []
    for lg in picked:
        code = reg.get(lg, {}).get("espn")
        if not code:
            continue
        teams = espn_teams(code)
        if not teams:
            continue
        # download crests we don't already have
        for t in teams:
            dest = LOGO_DIR / f"{t['id']}.png"
            if not dest.exists():
                try:
                    dest.write_bytes(get(t["logo"]))
                    downloaded += 1
                except Exception:
                    pass
        # register ESPN's own spellings, and build match candidates
        cands = [(int(t["id"]), norm(n), t["tokens"]) for t in teams for n in t["names"]]
        for t in teams:
            for n in t["names"]:
                mapping[norm(n)] = t["id"]
        # match this league's FBref team names -> espn id
        fb_teams = [r[0] for r in conn.execute(
            "SELECT DISTINCT team FROM players WHERE league=?", (lg,))]
        matched = 0
        for team in fb_teams:
            nk = norm(team)
            if nk in mapping:
                matched += 1
                continue
            tid = best_match(nk, cands)
            if tid is not None:
                mapping[nk] = str(tid)
                matched += 1
            else:
                unmatched.append(f"{lg}:{team}")
        total_matched += matched
        print(f"  {lg:20} ESPN {code:7} {len(teams):3} crests | matched {matched}/{len(fb_teams)} FBref hold", flush=True)

    conn.close()
    OUT.write_text(json.dumps(dict(sorted(mapping.items())), indent=0, ensure_ascii=False) + "\n", "utf-8")
    print(f"\ndownloaded {downloaded} new crests -> {LOGO_DIR}")
    print(f"map: {len(mapping)} name keys -> {OUT}")
    if unmatched:
        print(f"UNMATCHED ({len(unmatched)}): {', '.join(unmatched)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
