-- OtoScout local scouting database (read-only from the Next.js app).
-- One row per player per league-season. RAW counting stats only — per-90,
-- percentiles and the value model are derived in the Node read layer, never
-- stored, so the model can change without re-fetching.
--
-- NB on the FBref Jan-2026 restructure: the Defense, Passing and Possession
-- tables (and all xG / progressive / SCA-GCA fields) were removed. So total
-- tackles, blocks and clearances no longer exist in source. The surviving
-- defensive counters are interceptions and tackles_won (from the Misc table).

-- Multi-league + multi-season: created once, never dropped. A fetch replaces
-- only the (league, season) it loaded, so other leagues and old seasons stay.
CREATE TABLE IF NOT EXISTS players (
  league        TEXT    NOT NULL,
  season        TEXT    NOT NULL,   -- soccerdata code, e.g. "2526"
  season_label  TEXT    NOT NULL,   -- human label, e.g. "2025/2026"
  team          TEXT    NOT NULL,
  player        TEXT    NOT NULL,
  nation        TEXT,
  pos           TEXT,
  age           INTEGER,
  born          INTEGER,

  -- playing time
  mp            INTEGER NOT NULL DEFAULT 0,  -- matches played
  starts        INTEGER NOT NULL DEFAULT 0,
  minutes       INTEGER NOT NULL DEFAULT 0,

  -- attacking outputs
  goals         INTEGER NOT NULL DEFAULT 0,
  assists       INTEGER NOT NULL DEFAULT 0,
  npg           INTEGER NOT NULL DEFAULT 0,  -- non-penalty goals (G-PK)
  pk            INTEGER NOT NULL DEFAULT 0,
  pkatt         INTEGER NOT NULL DEFAULT 0,
  shots         INTEGER NOT NULL DEFAULT 0,
  sot           INTEGER NOT NULL DEFAULT 0,  -- shots on target

  -- defensive / misc outputs (survivors of the restructure)
  interceptions INTEGER NOT NULL DEFAULT 0,
  tackles_won   INTEGER NOT NULL DEFAULT 0,
  crosses       INTEGER NOT NULL DEFAULT 0,

  -- discipline
  fouls         INTEGER NOT NULL DEFAULT 0,  -- fouls committed
  fouled        INTEGER NOT NULL DEFAULT 0,  -- fouls drawn
  offsides      INTEGER NOT NULL DEFAULT 0,
  yellows       INTEGER NOT NULL DEFAULT 0,
  reds          INTEGER NOT NULL DEFAULT 0,

  -- goalkeeping (the 'keeper' table). NULL for non-keepers, not 0.
  gk_saves        INTEGER,
  gk_ga           INTEGER,  -- goals against
  gk_sota         INTEGER,  -- shots on target against
  gk_clean_sheets INTEGER,
  gk_save_pct     REAL,     -- save percentage (already a rate)
  gk_pk_saved     INTEGER,

  -- wages bolt on later (minutes is the day-one denominator)
  weekly_wage   INTEGER,

  PRIMARY KEY (league, season, team, player)
);

CREATE INDEX IF NOT EXISTS idx_players_league_season ON players (league, season);
