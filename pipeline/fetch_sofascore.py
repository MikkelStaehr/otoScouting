#!/usr/bin/env python
"""Fetch Danish Superliga player season stats from Sofascore via ScraperFC.

The SECOND data source, run ALONGSIDE pipeline/fetch.py (FBref). Sofascore is
Opta-style and adds what FBref lost: xG, xA, pass %, long balls, chances
created, big chances, goals prevented, and real defensive duels. One API call,
no browser — cron-friendly. ScraperFC handles Sofascore's Cloudflare bypass, so
upkeep is mostly `pip install -U ScraperFC`.

  python pipeline/fetch_sofascore.py --season 25/26 --db scouting.db
"""

from __future__ import annotations

import argparse
import sqlite3
import db as _pdb
from pathlib import Path

import pandas as pd
import ScraperFC as sfc
import ScraperFC.sofascore as sof

from registry import load_leagues
from snapshots import archive

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = Path(__file__).resolve().parent / "schema_sofascore.sql"
SCHEMA_TEAMS = Path(__file__).resolve().parent / "schema_teams.sql"

# All per-league config lives in config/leagues.json (see pipeline/registry.py).
# Only the current season per league is fetched — old seasons accumulate
# naturally when a season rolls over (the table is never dropped).
LEAGUES = load_leagues()

# db column -> Sofascore dataframe column
COLUMNS: dict[str, str] = {
    "player_id": "player id", "team_id": "team id",
    "player": "player", "team": "team",
    "appearances": "appearances", "matches_started": "matchesStarted",
    "minutes": "minutesPlayed", "rating": "rating",
    "goals": "goals", "assists": "assists",
    "xg": "expectedGoals", "xa": "expectedAssists",
    "total_shots": "totalShots", "shots_on_target": "shotsOnTarget",
    "big_chances_missed": "bigChancesMissed",
    "goal_conversion_pct": "goalConversionPercentage", "penalty_goals": "penaltyGoals",
    "key_passes": "keyPasses", "big_chances_created": "bigChancesCreated",
    "successful_dribbles": "successfulDribbles", "was_fouled": "wasFouled",
    "total_passes": "totalPasses", "accurate_passes": "accuratePasses",
    "pass_accuracy_pct": "accuratePassesPercentage",
    "accurate_long_balls": "accurateLongBalls",
    "long_ball_accuracy_pct": "accurateLongBallsPercentage",
    "accurate_final_third_passes": "accurateFinalThirdPasses",
    "accurate_crosses": "accurateCrosses",
    "tackles": "tackles", "tackles_won": "tacklesWon",
    "interceptions": "interceptions", "clearances": "clearances",
    "blocked_shots": "blockedShots", "outfielder_blocks": "outfielderBlocks",
    "ball_recovery": "ballRecovery", "poss_won_att_third": "possessionWonAttThird",
    "aerial_duels_won": "aerialDuelsWon", "ground_duels_won": "groundDuelsWon",
    "duels_won_pct": "totalDuelsWonPercentage", "dispossessed": "dispossessed",
    "error_lead_to_shot": "errorLeadToShot",
    "saves": "saves", "goals_conceded": "goalsConceded",
    "goals_prevented": "goalsPrevented", "clean_sheet": "cleanSheet",
    "penalty_save": "penaltySave", "high_claims": "highClaims", "runs_out": "runsOut",
    "yellow_cards": "yellowCards", "red_cards": "redCards",
    "fouls": "fouls", "offsides": "offsides",
}

# Team season stats (one row per team) — db column -> Sofascore column.
# Includes the "Against" mirror for the defensive side.
TEAM_COLUMNS: dict[str, str] = {
    "sofascore_team_id": "teamId", "team": "teamName", "matches": "matches",
    "goals": "goalsScored", "shots": "shots", "sot": "shotsOnTarget",
    "big_chances": "bigChances", "big_chances_created": "bigChancesCreated",
    "big_chances_missed": "bigChancesMissed", "corners": "corners",
    "possession": "averageBallPossession", "accurate_passes": "accuratePasses",
    "pass_pct": "accuratePassesPercentage", "accurate_long_balls": "accurateLongBalls",
    "goals_conceded": "goalsConceded", "shots_against": "shotsAgainst",
    "sot_against": "shotsOnTargetAgainst", "big_chances_against": "bigChancesAgainst",
    "clean_sheets": "cleanSheets", "interceptions": "interceptions", "tackles": "tackles",
    "errors_to_shot_against": "errorsLeadingToShotAgainst",
    "duels_won_pct": "duelsWonPercentage", "aerials_won_pct": "aerialDuelsWonPercentage",
    "avg_rating": "avgRating",
}

# Columns stored as REAL (rates / model outputs / negatives); the rest are
# integer counts. player/team are text; *_id are integers.
REAL_COLS = {
    "rating", "xg", "xa", "goal_conversion_pct", "pass_accuracy_pct",
    "long_ball_accuracy_pct", "duels_won_pct", "goals_prevented",
    # team rates
    "possession", "pass_pct", "aerials_won_pct", "avg_rating",
}
TEXT_COLS = {"player", "team"}
ID_COLS = {"player_id", "team_id"}


def coerce(db_col: str, series: pd.Series) -> list:
    if db_col in TEXT_COLS:
        return [None if pd.isna(v) else str(v) for v in series]
    num = pd.to_numeric(series, errors="coerce")
    if db_col in REAL_COLS:
        return [None if pd.isna(v) else float(v) for v in num]
    # integer counts + ids
    return [None if pd.isna(v) else int(round(v)) for v in num]


def season_codes(s: str) -> tuple[str, str]:
    """Sofascore season -> (db code, label). 25/26 -> 2526, 2025/2026. 2025 -> 2025, 2025."""
    if "/" in s:
        a, b = s.split("/")
        return s.replace("/", ""), f"20{a}/20{b}"
    return s, s


def migrate(conn: sqlite3.Connection) -> None:
    """Drop pre-multi-league tables (no `league` column) so they recreate fresh."""
    for t in ("sofascore_players", "sofascore_teams"):
        if conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (t,)
        ).fetchone():
            cols = [r[1] for r in conn.execute(f"PRAGMA table_info({t})")]
            if "league" not in cols:
                conn.execute(f"DROP TABLE {t}")
                print(f"  migrated: dropped old {t} (adding league dimension)")


def build(df: pd.DataFrame, mapping: dict, lk: str, code: str, label: str) -> tuple[list, list]:
    out = pd.DataFrame()
    for db_col, src_col in mapping.items():
        out[db_col] = coerce(db_col, df[src_col]) if src_col in df.columns else None
    out.insert(0, "league", lk)
    out.insert(1, "season", code)
    out.insert(2, "season_label", label)
    cols = ["league", "season", "season_label", *mapping.keys()]
    return cols, list(out[cols].itertuples(index=False, name=None))


def upsert(conn, table: str, lk: str, code: str, cols: list, rows: list) -> None:
    conn.execute(f"DELETE FROM {table} WHERE league=? AND season=?", (lk, code))
    ph = ",".join(["?"] * len(cols))
    conn.executemany(
        f"INSERT OR REPLACE INTO {table} ({','.join(cols)}) VALUES ({ph})", rows
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--league", default=None, help="league key (default: all)")
    ap.add_argument("--season", default=None, help="single Sofascore season override")
    ap.add_argument("--db", default=str(ROOT / "scouting.db"))
    args = ap.parse_args()

    keys = [args.league] if args.league else list(LEAGUES)
    ss = sfc.Sofascore()
    conn = _pdb.connect(Path(args.db))
    try:
        migrate(conn)
        conn.executescript(SCHEMA.read_text("utf-8"))
        conn.executescript(SCHEMA_TEAMS.read_text("utf-8"))
        archive(conn, "sofascore_players", "sofascore", "refresh")  # one snapshot

        total_p = total_t = 0
        failed: list[str] = []
        for lk in keys:
            cfg = LEAGUES[lk]
            # Register this league under its own key so ScraperFC can resolve it.
            sof.comps[lk] = {"SOFASCORE": cfg["sofascore"]}
            seasons = [args.season] if args.season else [cfg["sofascoreSeason"]]
            try:
                for sof_season in seasons:
                    code, label = season_codes(sof_season)
                    print(f"\n[{lk} {sof_season}] players…", flush=True)
                    dfp = ss.scrape_player_league_stats(sof_season, lk, accumulation="total")
                    pcols, prows = build(dfp, COLUMNS, lk, code, label)
                    upsert(conn, "sofascore_players", lk, code, pcols, prows)
                    print(f"  {len(prows)} players", flush=True)

                    print(f"[{lk} {sof_season}] teams…", flush=True)
                    dft = ss.scrape_team_league_stats(sof_season, lk)
                    tcols, trows = build(dft, TEAM_COLUMNS, lk, code, label)
                    upsert(conn, "sofascore_teams", lk, code, tcols, trows)
                    print(f"  {len(trows)} teams", flush=True)

                    total_p += len(prows)
                    total_t += len(trows)
            except Exception as e:  # isolate a bad league so the batch survives
                failed.append(lk)
                print(f"  ! {lk} FAILED: {type(e).__name__}: {str(e)[:120]}", flush=True)
        conn.commit()
        summary = conn.execute(
            "SELECT league, season, COUNT(*) FROM sofascore_teams GROUP BY league, season ORDER BY league, season"
        ).fetchall()
    finally:
        conn.close()

    print(f"\nWrote {total_p} player-rows + {total_t} team-rows -> {args.db}")
    for lg, se, n in summary:
        print(f"  {lg:<16} {se:<6} {n} teams")
    if failed:
        print(f"FAILED leagues ({len(failed)}): {', '.join(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
