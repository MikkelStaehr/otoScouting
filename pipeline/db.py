"""Shared SQLite connection for every pipeline writer.

WAL mode is the whole point: a running ingest holds a write connection while the
Next app reads scouting.db over on the other side — in the default rollback
journal a writer locks readers out ("database is locked"), in WAL they coexist
(one writer + many readers, readers see the last committed snapshot). busy_timeout
makes the rare genuine contention (e.g. a checkpoint) wait instead of throwing.
The reader side sets the matching pragma in lib/db.ts.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path


def connect(path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path), timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")     # persistent; coexist with readers
    conn.execute("PRAGMA busy_timeout=10000")   # wait up to 10s on a lock, don't throw
    conn.execute("PRAGMA synchronous=NORMAL")   # WAL-safe + much faster bulk writes
    return conn
