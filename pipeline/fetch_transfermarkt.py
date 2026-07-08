"""Transfermarkt market values -> transfermarkt_players. The "value" side of
value-per-output. Scrapes LIGHT: one request per club squad page (~18-20 per league)
instead of one per player (~1000+), so it stays paced and doesn't get the IP flagged.
cloudscraper handles Transfermarkt's Cloudflare (no browser). Reads TM competition
codes from the registry (config/leagues.json `transfermarkt`).

  python pipeline/fetch_transfermarkt.py                    # all registry leagues
  python pipeline/fetch_transfermarkt.py --league FRA-Ligue2
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import db as _pdb
import sys
import time
from pathlib import Path

import cloudscraper
from bs4 import BeautifulSoup

from registry import load_leagues

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = Path(__file__).resolve().parent / "schema_transfermarkt.sql"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
BASE = "https://www.transfermarkt.us"


def season_codes(s: str) -> tuple[str, str]:
    """registry season -> (db_code, db_label). '25/26'->('2526','2025/2026'); '2026'->('2026','2026')."""
    if "/" in s:
        a, b = s.split("/")
        return f"{a}{b}", f"20{a}/20{b}"
    return s, s


def value_eur(t: str) -> int | None:
    t = (t or "").replace("€", "").strip()
    if not t or t == "-":
        return None
    mult = 1
    if t.endswith("m"):
        mult, t = 1_000_000, t[:-1]
    elif t.endswith("k"):
        mult, t = 1_000, t[:-1]
    try:
        return int(float(t) * mult)
    except ValueError:
        return None


def scrape_club(scraper, club_id: str, saison_id: str) -> tuple[str, list[dict]]:
    url = f"{BASE}/-/kader/verein/{club_id}/saison_id/{saison_id}/plus/1"
    soup = BeautifulSoup(scraper.get(url, headers=UA, timeout=30).text, "html.parser")
    h1 = soup.select_one("h1.data-header__headline-wrapper")
    team = re.sub(r"\s+", " ", h1.get_text(strip=True)) if h1 else None
    tbl = soup.select_one("table.items")
    out: list[dict] = []
    if not tbl:
        return team, out
    for tr in tbl.select("tbody > tr.odd, tbody > tr.even"):
        cell = tr.select_one("td.posrela")
        a = cell.select_one("td.hauptlink a") if cell else None
        if not a or not a.get("href"):
            continue
        m = re.search(r"/spieler/(\d+)", a["href"])
        if not m:
            continue
        pos_td = cell.select("table.inline-table tr")
        position = pos_td[1].get_text(strip=True) if len(pos_td) > 1 else None
        tds = tr.find_all("td", recursive=False)
        age = None
        if len(tds) > 2:
            am = re.search(r"\((\d+)\)", tds[2].get_text(strip=True))
            age = int(am.group(1)) if am else None
        nat_img = tds[3].find("img") if len(tds) > 3 else None
        nationality = nat_img.get("title") if nat_img else None
        vtxt = tds[-1].get_text(strip=True) if tds else ""
        out.append({
            "tm_id": int(m.group(1)), "name": a.get_text(strip=True),
            "position": position, "age": age, "nationality": nationality,
            "market_value": value_eur(vtxt), "value_text": vtxt or None,
        })
    return team, out


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", default=None)
    ap.add_argument("--db", default=str(ROOT / "scouting.db"))
    ap.add_argument("--pause", type=float, default=0.7)
    args = ap.parse_args()

    import ScraperFC.transfermarkt as tmmod
    tm = tmmod.Transfermarkt()
    scraper = cloudscraper.CloudScraper()

    conn = _pdb.connect(args.db)
    conn.executescript(SCHEMA.read_text("utf-8"))

    reg = load_leagues()
    leagues = [args.league] if args.league else list(reg)
    for lk in leagues:
        cfg = reg.get(lk, {})
        code = cfg.get("transfermarkt")
        if not code:
            print(f"[{lk}] ingen TM-kode — springer over", flush=True)
            continue
        season_key = cfg.get("sofascoreSeason") or cfg.get("fbrefSeason")
        db_code, db_label = season_codes(season_key)
        tmmod.comps[lk] = {"TRANSFERMARKT": f"{BASE}/-/startseite/wettbewerb/{code}"}
        print(f"[{lk}] TM {code} · sæson {season_key}…", flush=True)
        try:
            # saison_id is TM's own id for this season — look it up, never derive
            # (calendar-year leagues map season '2026' -> saison_id '2025', not '2026').
            saison_id = tm.get_valid_seasons(lk).get(season_key)
            if not saison_id:
                print(f"  ! sæson {season_key} ikke gyldig på TM — springer over", flush=True)
                continue
            clubs = tm.get_club_links(season_key, lk)
        except Exception as e:
            print(f"  ! klub-links fejlede: {type(e).__name__} — springer over", flush=True)
            continue
        rows: list[tuple] = []
        for cl in clubs:
            cm = re.search(r"/verein/(\d+)", cl)
            if not cm:
                continue
            try:
                team, players = scrape_club(scraper, cm.group(1), saison_id)
            except Exception as e:
                print(f"    klub {cm.group(1)} fejlede: {type(e).__name__}", flush=True)
                continue
            for p in players:
                rows.append((lk, db_code, db_label, p["tm_id"], p["name"], team,
                             p["position"], p["age"], p["nationality"],
                             p["market_value"], p["value_text"]))
            time.sleep(args.pause)
        conn.execute("DELETE FROM transfermarkt_players WHERE league=? AND season=?", (lk, db_code))
        conn.executemany(
            "INSERT OR REPLACE INTO transfermarkt_players "
            "(league,season,season_label,tm_id,name,team,position,age,nationality,market_value,value_text) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)", rows)
        conn.commit()
        valued = sum(1 for r in rows if r[9] is not None)
        print(f"  -> {len(rows)} spillere ({valued} m. værdi), {len(clubs)} klubber", flush=True)

    # kort oversigt
    print("\n=== transfermarkt_players ===", flush=True)
    for r in conn.execute("SELECT league, season, COUNT(*), COUNT(market_value) FROM transfermarkt_players GROUP BY league, season ORDER BY league"):
        print(f"  {r[0]:20} {r[1]:5} {r[2]:4} spillere ({r[3]} m. værdi)", flush=True)
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
