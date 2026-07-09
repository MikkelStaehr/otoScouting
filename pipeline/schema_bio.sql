-- Static player bio from Sofascore's per-player endpoint (height + preferred foot).
-- Keyed on the Sofascore player id (bio doesn't change per season), so it's a
-- one-time backfill + a cheap incremental for new players. Weight isn't in the API.
CREATE TABLE IF NOT EXISTS player_bio (
  player_id  INTEGER PRIMARY KEY,  -- Sofascore player id
  height     INTEGER,              -- cm (null if Sofascore has none)
  foot       TEXT,                 -- Right / Left / Both (null if unknown)
  fetched_at TEXT
);
