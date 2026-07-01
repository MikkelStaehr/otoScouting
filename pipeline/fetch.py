#!/usr/bin/env python
"""Fetch one league-season of FBref player stats via soccerdata -> scouting.db.

This is the ONLY network step in the whole project. Re-runs hit soccerdata's
local scrape cache, so they're effectively offline.

  python pipeline/fetch.py                         # Danish Superliga 2025/26
  python pipeline/fetch.py --league DEN-Superliga --season 2025-2026 --db scouting.db

Only counting stats that survive FBref's Jan-2026 restructure are stored
(standard / shooting / misc tables). No xG, no defense/passing/possession.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

import pandas as pd
import soccerdata as sd

from registry import load_leagues
from snapshots import archive

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = Path(__file__).resolve().parent / "schema.sql"

LEAGUES = load_leagues()

# soccerdata only ships the big leagues; the rest must be registered in its user
# config. Build that registration straight from our registry (config/leagues.json).
CUSTOM_LEAGUES = {
    lk: {
        "FBref": cfg["fbref"],
        "season_start": cfg["seasonStart"],
        "season_end": cfg["seasonEnd"],
    }
    for lk, cfg in LEAGUES.items()
}


def ensure_leagues_registered() -> None:
    """Idempotently merge CUSTOM_LEAGUES into ~/soccerdata/config/league_dict.json."""
    cfg = Path.home() / "soccerdata" / "config" / "league_dict.json"
    cfg.parent.mkdir(parents=True, exist_ok=True)
    current = {}
    if cfg.exists():
        try:
            current = json.loads(cfg.read_text("utf-8"))
        except json.JSONDecodeError:
            current = {}
    changed = False
    for name, entry in CUSTOM_LEAGUES.items():
        if current.get(name) != entry:
            current[name] = entry
            changed = True
    if changed:
        cfg.write_text(json.dumps(current, indent=2), "utf-8")
        print(f"  registered custom league(s) in {cfg}")


def pick(df: pd.DataFrame, leaf: str, prefer_tops: tuple[str, ...] = ()) -> pd.Series | None:
    """Select a column from an FBref (possibly MultiIndex) frame by its leaf name.

    FBref tables repeat leaf names across top groups (e.g. 'Gls' under both
    'Performance' and 'Per 90 Minutes'), so prefer an explicit top group and
    never fall back to a per-90 column.
    """
    candidates: list[tuple[str, object]] = []
    for c in df.columns:
        leaf_name = c[-1] if isinstance(c, tuple) else c
        top_name = c[0] if isinstance(c, tuple) else ""
        if leaf_name == leaf:
            candidates.append((top_name, c))
    if not candidates:
        return None
    for pt in prefer_tops:
        for top_name, col in candidates:
            if top_name == pt:
                return df[col]
    for top_name, col in candidates:
        if top_name != "Per 90 Minutes":
            return df[col]
    return df[candidates[0][1]]


def ints(series: pd.Series | None, n: int) -> list[int]:
    if series is None:
        return [0] * n
    return pd.to_numeric(series, errors="coerce").fillna(0).round().astype(int).tolist()


def strs(series: pd.Series | None, n: int) -> list[object]:
    if series is None:
        return [None] * n
    return [None if pd.isna(v) else str(v) for v in series.tolist()]


def ages(series: pd.Series | None, n: int) -> list[object]:
    """FBref age is 'YY-DDD' (years-days) for an in-progress season and a plain
    int for a finished one. Take the years part either way; None if unparseable."""
    if series is None:
        return [None] * n
    out: list[object] = []
    for v in series.tolist():
        if pd.isna(v):
            out.append(None)
            continue
        head = str(v).strip().split("-")[0]
        try:
            out.append(int(float(head)))
        except ValueError:
            out.append(None)
    return out


# leaf name -> preferred top group, per stat table
STANDARD = {
    "mp": ("MP", ("Playing Time",)),
    "starts": ("Starts", ("Playing Time",)),
    "minutes": ("Min", ("Playing Time",)),
    "goals": ("Gls", ("Performance",)),
    "assists": ("Ast", ("Performance",)),
    "npg": ("G-PK", ("Performance",)),
    "pk": ("PK", ("Performance",)),
    "pkatt": ("PKatt", ("Performance",)),
    "yellows": ("CrdY", ("Performance",)),
    "reds": ("CrdR", ("Performance",)),
}
SHOOTING = {
    "shots": ("Sh", ("Standard",)),
    "sot": ("SoT", ("Standard",)),
}
MISC = {
    "fouls": ("Fls", ("Performance",)),
    "fouled": ("Fld", ("Performance",)),
    "offsides": ("Off", ("Performance",)),
    "crosses": ("Crs", ("Performance",)),
    "interceptions": ("Int", ("Performance",)),
    "tackles_won": ("TklW", ("Performance",)),
}
# Goalkeeping (the 'keeper' table — keepers only, survives Jan-2026: no PSxG).
# gk_save_pct is a rate; the rest are counts. Non-keepers get NULL, not 0.
KEEPER_COUNTS = {
    "gk_saves": ("Saves", ("Performance",)),
    "gk_ga": ("GA", ("Performance",)),
    "gk_sota": ("SoTA", ("Performance",)),
    "gk_clean_sheets": ("CS", ("Performance",)),
    "gk_pk_saved": ("PKsv", ("Penalty Kicks",)),
}
KEEPER_SAVE_PCT = ("Save%", ("Performance",))


def key_frame(df: pd.DataFrame) -> pd.DataFrame:
    """team+player key columns from the FBref index, in row order."""
    idx = df.index.to_frame(index=False)
    return idx[["team", "player"]].reset_index(drop=True)


def meta_col(df: pd.DataFrame, name: str) -> pd.Series | None:
    """Player meta (nation/pos/age/born) sit in columns whose TOP MultiIndex
    level is the name and whose leaf is empty, e.g. ('nation', '')."""
    for c in df.columns:
        top = c[0] if isinstance(c, tuple) else c
        if top == name:
            return df[c]
    return None


def extract(df: pd.DataFrame, mapping: dict[str, tuple[str, tuple[str, ...]]]) -> pd.DataFrame:
    n = len(df)
    out = key_frame(df)
    for col_name, (leaf, tops) in mapping.items():
        out[col_name] = ints(pick(df, leaf, tops), n)
    return out


def extract_keeper(df: pd.DataFrame) -> pd.DataFrame:
    n = len(df)
    out = key_frame(df)
    for col_name, (leaf, tops) in KEEPER_COUNTS.items():
        out[col_name] = ints(pick(df, leaf, tops), n)
    sp = pick(df, *KEEPER_SAVE_PCT)
    out["gk_save_pct"] = (
        pd.to_numeric(sp, errors="coerce").round(1).tolist()
        if sp is not None
        else [None] * n
    )
    return out


def main() -> int:
    try:  # Windows cp1252 console chokes on Nordic names in the sanity print
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", default="DEN-Superliga")
    ap.add_argument("--season", default=None, help="FBref season (default: registry's current)")
    ap.add_argument("--db", default=str(ROOT / "scouting.db"))
    args = ap.parse_args()

    # Default the season to the registry's current one for this league.
    if args.season is None:
        args.season = LEAGUES[args.league]["fbrefSeason"]

    ensure_leagues_registered()

    print(f"Fetching {args.league} {args.season} from FBref (soccerdata)…")
    fb = sd.FBref(leagues=args.league, seasons=args.season)

    std = fb.read_player_season_stats(stat_type="standard")
    sho = fb.read_player_season_stats(stat_type="shooting")
    mis = fb.read_player_season_stats(stat_type="misc")
    kee = fb.read_player_season_stats(stat_type="keeper")
    print(f"  standard={len(std)}  shooting={len(sho)}  misc={len(mis)}  keeper={len(kee)}")
    print("  keeper cols:", [c[-1] if isinstance(c, tuple) else c for c in kee.columns])

    # Spine = standard (every player with playing time). Meta + attacking here.
    n = len(std)
    base = key_frame(std)
    base["nation"] = strs(meta_col(std, "nation"), n)
    base["pos"] = strs(meta_col(std, "pos"), n)
    base["age"] = ages(meta_col(std, "age"), n)
    base["born"] = ints(meta_col(std, "born"), n)
    # Fall back to born-derived age (season end year − born) where FBref had none.
    ref_year = int(args.season.replace("/", "-").split("-")[-1])
    base["age"] = [
        a if a not in (None, 0) else (ref_year - b if b else None)
        for a, b in zip(base["age"], base["born"])
    ]
    for col_name, (leaf, tops) in STANDARD.items():
        base[col_name] = ints(pick(std, leaf, tops), n)

    merged = (
        base
        .merge(extract(sho, SHOOTING), on=["team", "player"], how="left")
        .merge(extract(mis, MISC), on=["team", "player"], how="left")
        .merge(extract_keeper(kee), on=["team", "player"], how="left")
    )

    # Fill any unmatched OUTFIELD counting stats with 0 and stamp league/season.
    count_cols = list(STANDARD) + list(SHOOTING) + list(MISC)
    merged[count_cols] = merged[count_cols].fillna(0).round().astype(int)
    # GK stats are NULL for non-keepers (NaN -> None), not 0.
    for col in KEEPER_COUNTS:
        merged[col] = merged[col].apply(lambda v: None if pd.isna(v) else int(v))
    merged["gk_save_pct"] = merged["gk_save_pct"].apply(
        lambda v: None if pd.isna(v) else float(v)
    )
    # soccerdata's own season code: last 2 of start + last 2 of end (2025-2026 -> 2526)
    parts = args.season.replace("/", "-").split("-")
    season_code = parts[0][-2:] + parts[1][-2:] if len(parts) == 2 else args.season
    merged.insert(0, "league", args.league)
    merged.insert(1, "season", season_code)
    merged.insert(2, "season_label", args.season.replace("-", "/"))
    merged["weekly_wage"] = None

    # Write the DB from schema.sql, then insert.
    db_path = Path(args.db)
    conn = sqlite3.connect(db_path)
    try:
        archive(conn, "players", "fbref", args.season)  # keep previous fetch
        conn.executescript(SCHEMA.read_text("utf-8"))
        # Replace only THIS league-season (clears players who transferred out).
        conn.execute(
            "DELETE FROM players WHERE league=? AND season=?",
            (args.league, season_code),
        )
        cols = [
            "league", "season", "season_label", "team", "player", "nation", "pos",
            "age", "born", "mp", "starts", "minutes", "goals", "assists", "npg",
            "pk", "pkatt", "shots", "sot", "interceptions", "tackles_won",
            "crosses", "fouls", "fouled", "offsides", "yellows", "reds",
            "gk_saves", "gk_ga", "gk_sota", "gk_clean_sheets", "gk_save_pct",
            "gk_pk_saved", "weekly_wage",
        ]
        rows = list(merged[cols].itertuples(index=False, name=None))
        placeholders = ",".join(["?"] * len(cols))
        conn.executemany(
            f"INSERT OR REPLACE INTO players ({','.join(cols)}) VALUES ({placeholders})",
            rows,
        )
        conn.commit()

        top = conn.execute(
            "SELECT player, team, minutes, goals, assists FROM players "
            "ORDER BY goals DESC, assists DESC LIMIT 5"
        ).fetchall()
        gk_count = conn.execute(
            "SELECT COUNT(*) FROM players WHERE gk_saves IS NOT NULL"
        ).fetchone()[0]
        gks = conn.execute(
            "SELECT player, team, gk_saves, gk_clean_sheets, gk_save_pct FROM players "
            "WHERE gk_saves IS NOT NULL ORDER BY gk_saves DESC LIMIT 5"
        ).fetchall()
    finally:
        conn.close()

    print(f"\nWrote {len(rows)} players -> {db_path}")
    print("Top scorers (sanity check):")
    for player, team, minutes, goals, assists in top:
        print(f"  {player:<24} {team:<14} {minutes:>5} min  {goals}G {assists}A")
    print(f"\nGoalkeepers with stats: {gk_count}")
    for player, team, saves, cs, sp in gks:
        print(f"  {player:<24} {team:<14} {saves} saves  {cs} CS  {sp}% save")
    return 0


if __name__ == "__main__":
    sys.exit(main())
