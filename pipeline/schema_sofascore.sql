-- Sofascore (Opta-style) player season stats — the SECOND data source, run
-- ALONGSIDE the FBref pipeline. This is the rich layer: xG, xA, pass %, long
-- balls, chances created, big chances, goals prevented and real defensive
-- duels — data FBref no longer has. One row per player per season.
--
-- Kept deliberately separate from the FBref `players` table for now; merging
-- the two (on player name + season) is a later step.

-- Multi-league + multi-season: created once, never dropped. A refresh replaces
-- only the (league, season) it fetched, so old seasons stay for comparison.
CREATE TABLE IF NOT EXISTS sofascore_players (
  league        TEXT    NOT NULL,   -- "DEN-Superliga"
  season        TEXT    NOT NULL,   -- "2526"
  season_label  TEXT    NOT NULL,   -- "2025/2026"
  player_id     INTEGER NOT NULL,   -- Sofascore player id (stable key)
  team_id       INTEGER,
  player        TEXT    NOT NULL,
  team          TEXT    NOT NULL,

  -- playing time
  appearances     INTEGER NOT NULL DEFAULT 0,
  matches_started INTEGER NOT NULL DEFAULT 0,
  minutes         INTEGER NOT NULL DEFAULT 0,
  rating          REAL,              -- Sofascore avg match rating

  -- attacking (xG/xA are Sofascore's own model)
  goals               INTEGER NOT NULL DEFAULT 0,
  assists             INTEGER NOT NULL DEFAULT 0,
  xg                  REAL,
  xa                  REAL,
  total_shots         INTEGER NOT NULL DEFAULT 0,
  shots_on_target     INTEGER NOT NULL DEFAULT 0,
  big_chances_missed  INTEGER NOT NULL DEFAULT 0,
  goal_conversion_pct REAL,
  penalty_goals       INTEGER NOT NULL DEFAULT 0,

  -- creation
  key_passes          INTEGER NOT NULL DEFAULT 0,  -- chances created
  big_chances_created INTEGER NOT NULL DEFAULT 0,
  successful_dribbles INTEGER NOT NULL DEFAULT 0,
  was_fouled          INTEGER NOT NULL DEFAULT 0,

  -- passing / build-up
  total_passes                INTEGER NOT NULL DEFAULT 0,
  accurate_passes             INTEGER NOT NULL DEFAULT 0,
  pass_accuracy_pct           REAL,
  accurate_long_balls         INTEGER NOT NULL DEFAULT 0,
  long_ball_accuracy_pct      REAL,
  accurate_final_third_passes INTEGER NOT NULL DEFAULT 0,
  accurate_crosses            INTEGER NOT NULL DEFAULT 0,

  -- defensive
  tackles            INTEGER NOT NULL DEFAULT 0,
  tackles_won        INTEGER NOT NULL DEFAULT 0,
  interceptions      INTEGER NOT NULL DEFAULT 0,
  clearances         INTEGER NOT NULL DEFAULT 0,
  blocked_shots      INTEGER NOT NULL DEFAULT 0,
  outfielder_blocks  INTEGER NOT NULL DEFAULT 0,
  ball_recovery      INTEGER NOT NULL DEFAULT 0,
  poss_won_att_third INTEGER NOT NULL DEFAULT 0,
  aerial_duels_won   INTEGER NOT NULL DEFAULT 0,
  ground_duels_won   INTEGER NOT NULL DEFAULT 0,
  duels_won_pct      REAL,
  dispossessed       INTEGER NOT NULL DEFAULT 0,
  error_lead_to_shot INTEGER NOT NULL DEFAULT 0,

  -- goalkeeping
  saves          INTEGER NOT NULL DEFAULT 0,
  goals_conceded INTEGER NOT NULL DEFAULT 0,
  goals_prevented REAL,             -- post-shot xG minus goals conceded
  clean_sheet    INTEGER NOT NULL DEFAULT 0,
  penalty_save   INTEGER NOT NULL DEFAULT 0,
  high_claims    INTEGER NOT NULL DEFAULT 0,
  runs_out       INTEGER NOT NULL DEFAULT 0,

  -- discipline
  yellow_cards INTEGER NOT NULL DEFAULT 0,
  red_cards    INTEGER NOT NULL DEFAULT 0,
  fouls        INTEGER NOT NULL DEFAULT 0,
  offsides     INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (league, season, player_id)
);

CREATE INDEX IF NOT EXISTS idx_sofa_ls ON sofascore_players (league, season);
CREATE INDEX IF NOT EXISTS idx_sofa_name ON sofascore_players (player);
