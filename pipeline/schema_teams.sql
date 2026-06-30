-- Sofascore team season stats. Multi-league + multi-season: one row per
-- (league, season, team). Created once, never dropped — a refresh replaces
-- only the (league, season) it fetched, so old seasons stay for comparison.

CREATE TABLE IF NOT EXISTS sofascore_teams (
  league             TEXT    NOT NULL,
  season             TEXT    NOT NULL,
  season_label       TEXT    NOT NULL,
  sofascore_team_id  INTEGER NOT NULL,
  team               TEXT    NOT NULL,
  matches            INTEGER NOT NULL DEFAULT 0,

  -- attacking
  goals               INTEGER NOT NULL DEFAULT 0,
  shots               INTEGER NOT NULL DEFAULT 0,
  sot                 INTEGER NOT NULL DEFAULT 0,
  big_chances         INTEGER NOT NULL DEFAULT 0,
  big_chances_created INTEGER NOT NULL DEFAULT 0,
  big_chances_missed  INTEGER NOT NULL DEFAULT 0,
  corners             INTEGER NOT NULL DEFAULT 0,
  possession          REAL,
  accurate_passes     INTEGER NOT NULL DEFAULT 0,
  pass_pct            REAL,
  accurate_long_balls INTEGER NOT NULL DEFAULT 0,

  -- defending (mostly the "Against" mirror)
  goals_conceded         INTEGER NOT NULL DEFAULT 0,
  shots_against          INTEGER NOT NULL DEFAULT 0,
  sot_against            INTEGER NOT NULL DEFAULT 0,
  big_chances_against    INTEGER NOT NULL DEFAULT 0,
  clean_sheets           INTEGER NOT NULL DEFAULT 0,
  interceptions          INTEGER NOT NULL DEFAULT 0,
  tackles                INTEGER NOT NULL DEFAULT 0,
  errors_to_shot_against INTEGER NOT NULL DEFAULT 0,

  -- duels + rating
  duels_won_pct   REAL,
  aerials_won_pct REAL,
  avg_rating      REAL,

  PRIMARY KEY (league, season, sofascore_team_id)
);
