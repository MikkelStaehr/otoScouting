-- Transfermarkt market values — the "value" side of value-per-output. One row per
-- player per (league, season), scraped light from club squad pages (not per-player).
-- Multi-league + multi-season like every other table: keyed by league+season, never
-- dropped, refreshed with DELETE+INSERT per (league, season).
CREATE TABLE IF NOT EXISTS transfermarkt_players (
  league        TEXT    NOT NULL,
  season        TEXT    NOT NULL,   -- our normalised code (2526 / 2026)
  season_label  TEXT,
  tm_id         INTEGER NOT NULL,   -- Transfermarkt player id
  name          TEXT    NOT NULL,
  team          TEXT,
  position      TEXT,
  age           INTEGER,
  nationality   TEXT,
  market_value  INTEGER,            -- euros (350000, 1200000); NULL if unknown ("-")
  value_text    TEXT,               -- raw as shown ("€350k", "€1.20m") for display/debug
  PRIMARY KEY (league, season, tm_id)
);
CREATE INDEX IF NOT EXISTS idx_tm_ls ON transfermarkt_players (league, season);
CREATE INDEX IF NOT EXISTS idx_tm_name ON transfermarkt_players (name);
