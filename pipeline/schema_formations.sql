-- Formations a team lined up in across a season's matches (from Sofascore match
-- lineups). One row per (team, formation) with the match count; the app shows the
-- top few. Keyed by Sofascore team id (stable).
CREATE TABLE IF NOT EXISTS team_formations (
  league    TEXT    NOT NULL,
  season    TEXT    NOT NULL,
  team_id   INTEGER NOT NULL,
  team      TEXT    NOT NULL,
  formation TEXT    NOT NULL,
  n         INTEGER NOT NULL,
  matches   INTEGER NOT NULL,  -- total matches the team had a formation for
  PRIMARY KEY (league, season, team_id, formation)
);
