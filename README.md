# OtoScout

A **local, single-user football scouting tool**. Private, localhost only, never
deployed. One data source: **FBref** (via [soccerdata](https://github.com/probberechts/soccerdata)).
Dark, broadcast-styled UI with a ⌘K player spotlight and a percentile-driven
scouting board.

The model is **value-per-output**: counting-stat outputs normalised by a
denominator. Day one the denominator is **minutes** (per-90); player **wages**
bolt on later as an alternative denominator.

> **No xG.** FBref's January 2026 restructure removed xG, progressive passing,
> SCA/GCA and the entire Defense/Passing/Possession tables. OtoScout builds only
> on the counting stats that still exist (see *Data* below). This is deliberate,
> not an oversight.

## Architecture

```
pipeline/            # Python — the ONLY network step
  fetch.py             # soccerdata (FBref) -> pandas -> scouting.db
  schema.sql           # players table (raw counting stats only)
  requirements.txt
config/
  model.json           # tunable: weights, per-90 stat set, min-minutes (live, no rebuild)
lib/                 # Node read + model layer
  db.ts                # node:sqlite, read-only (no native dependency)
  model.ts             # per-90, percentiles, weighted output score
  players.ts           # queries -> small view models
  types.ts, fuzzy.ts
app/                 # Next.js 15 App Router (Server Components read the DB)
components/          # player table + ⌘K palette (Client Components)
scouting.db          # generated, gitignored
```

Data flows one way: **Python writes `scouting.db` → Next reads it.** The browser
only ever receives small, pre-computed JSON. No runtime network calls anywhere
except the manual Python fetch.

## Setup

### 1. Build the database (Python)

soccerdata drives a headless Chrome under the hood, so **Chrome must be
installed**. Create the venv at a short path **outside the project** (on Windows,
deep OneDrive paths hit the venv long-path limit). Use Python 3.12 — 3.9 is too
old for the pinned deps.

**macOS / Linux:**

```bash
python3.12 -m venv ~/otoscout-venv
~/otoscout-venv/bin/python -m pip install -r pipeline/requirements.txt

# Sofascore — all leagues, fast (~30s), no browser. Run this first: it creates scouting.db.
~/otoscout-venv/bin/python pipeline/fetch_sofascore.py

# FBref — one call per league, slow (~10 min total, drives Chrome). Builds the players table.
# fetch.py auto-registers the Nordic leagues with soccerdata on first run.
~/otoscout-venv/bin/python pipeline/fetch.py --league DEN-Superliga   --season 2025-2026
~/otoscout-venv/bin/python pipeline/fetch.py --league SWE-Allsvenskan --season 2026
~/otoscout-venv/bin/python pipeline/fetch.py --league NOR-Eliteserien --season 2026
```

**Windows:** swap `~/otoscout-venv/bin/python` for `~/otoscout-venv/Scripts/python`
and use `py -m venv ~/otoscout-venv`.

First FBref run scrapes from cold (slow — cold browser + rate limit); re-runs hit
soccerdata's local cache. Let each fetch finish — a killed FBref run leaves the
`players` table uncreated, and the app then errors with `no such table: players`.

> **Custom-league gotcha:** the Nordic leagues aren't built into soccerdata, so
> `fetch.py` registers them in `~/soccerdata/config/league_dict.json`. soccerdata
> reads that file at *import* time, so the very first run after a fresh install
> may fail with `Invalid league` — just run it again and it works.

### 2. Run the app (Node 24+ recommended)

`lib/db.ts` uses the built-in `node:sqlite` module (no native dependency). That
module is **stable without a flag only on Node 24+**. On Node 22 it exists but is
experimental — you must pass `--experimental-sqlite` (e.g.
`NODE_OPTIONS=--experimental-sqlite npm run dev`). On Node 20 and earlier it does
not exist at all (`No such built-in module: node:sqlite`). A `.nvmrc` pins Node 24
— run `nvm use` in the project to pick it up.

```bash
nvm use            # selects Node 24 from .nvmrc
npm install
npm run dev        # http://localhost:3000 — ⌘K to find a player
```

## The model (`config/model.json`)

Edit and refresh — no rebuild.

- `minMinutes` — qualification threshold; percentiles are computed within the
  qualified pool.
- `perNinety` — which counting stats get per-90 + percentile treatment.
- `outputScore.weights` — the **OUT** column is a weighted average of those
  stats' per-90 percentiles (0–100). Transparent, scale-free, fully tunable.

## Data (what FBref still exposes)

Stored per player per league-season, **raw counts only** (per-90/percentiles are
derived in Node, never stored — so the model can change without re-fetching):

- **Playing time** — matches, starts, minutes
- **Attacking** — goals, assists, non-penalty goals, shots, shots on target, PKs
- **Defensive (survivors)** — interceptions, tackles won *(total tackles, blocks
  and clearances no longer exist post-Jan-2026)*
- **Discipline / misc** — fouls, fouls drawn, offsides, crosses, yellows, reds

## Roadmap

- Slider filters with a live match count and auto-derived min/max.
- Two-player comparison overlay with a percentile radar (reuses the ⌘K overlay).
- Wage layer: a Capology / FBref-player-page scrape → value-per-wage column.

Data: FBref. Credit FBref/soccerdata if you publish anything built on it.
