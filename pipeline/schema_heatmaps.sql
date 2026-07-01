-- Season action heatmaps from Sofascore — one row per player per league-season.
-- The raw endpoint returns ~1000-2000 {x,y,count} action cells; we bin them into
-- a small normalised grid (GRID_W x GRID_H, row-major, 0-1 intensity) stored as a
-- JSON array, so it's tiny and ready to draw as a pitch heatmap or compare.
CREATE TABLE IF NOT EXISTS player_heatmaps (
  league       TEXT    NOT NULL,   -- "DEN-Superliga"
  season       TEXT    NOT NULL,   -- "2526"
  player_id    INTEGER NOT NULL,   -- Sofascore player id
  grid_w       INTEGER NOT NULL,   -- columns (length of pitch, attacking →)
  grid_h       INTEGER NOT NULL,   -- rows (width)
  grid         TEXT    NOT NULL,   -- JSON array of grid_w*grid_h floats (0-1)
  n_points     INTEGER NOT NULL,   -- raw action cells aggregated
  matches      INTEGER,            -- matches the heatmap covers
  PRIMARY KEY (league, season, player_id)
);
