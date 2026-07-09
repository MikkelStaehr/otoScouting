"""Snapshot history: before a pipeline overwrites its table, archive the current
rows into `{table}_history` under a new timestamped snapshot. The live tables
(players / sofascore_players) and the app's read path stay unchanged; history is
purely additive, giving a comparison basis across fetches.
"""

from __future__ import annotations

import datetime
import sqlite3


def ensure_snapshots(conn: sqlite3.Connection) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS snapshots (
             id         INTEGER PRIMARY KEY AUTOINCREMENT,
             created_at TEXT    NOT NULL,
             source     TEXT    NOT NULL,
             season     TEXT,
             n_players  INTEGER
           )"""
    )


def archive(
    conn: sqlite3.Connection, table: str, source: str, season: str
) -> int | None:
    """Copy current `table` rows into `{table}_history` under a new snapshot,
    BEFORE the table is overwritten. No-op if the table is absent or empty."""
    ensure_snapshots(conn)

    exists = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    if not exists:
        return None
    n = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    if not n:
        return None

    hist = f"{table}_history"
    conn.execute(f"CREATE TABLE IF NOT EXISTS {hist} AS SELECT * FROM {table} WHERE 0")
    hist_cols = [r[1] for r in conn.execute(f"PRAGMA table_info({hist})")]
    # Reconcile schema drift: a history table created before a new column existed
    # (e.g. `league` after multi-league) must gain it, or the INSERT below fails.
    for c in (r[1] for r in conn.execute(f"PRAGMA table_info({table})")):
        if c not in hist_cols:
            conn.execute(f"ALTER TABLE {hist} ADD COLUMN {c}")
            hist_cols.append(c)
    if "snapshot_id" not in hist_cols:
        conn.execute(f"ALTER TABLE {hist} ADD COLUMN snapshot_id INTEGER")
    # The app reads history by snapshot_id (latest snapshot / MAX per league); without
    # an index that's a full scan of a ~300k-row table. Idempotent, cheap to re-run.
    conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{hist}_sid ON {hist}(snapshot_id)")

    ts = datetime.datetime.now().isoformat(timespec="seconds")
    sid = conn.execute(
        "INSERT INTO snapshots (created_at, source, season, n_players) VALUES (?,?,?,?)",
        (ts, source, season, n),
    ).lastrowid

    cols = ",".join(r[1] for r in conn.execute(f"PRAGMA table_info({table})"))
    conn.execute(
        f"INSERT INTO {hist} ({cols}, snapshot_id) SELECT {cols}, {sid} FROM {table}"
    )
    print(f"  archived {n} rows -> {hist} (snapshot #{sid}, {ts})")
    return sid
