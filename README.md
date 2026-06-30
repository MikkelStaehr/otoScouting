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
installed**. The project lives in a deep OneDrive path, and Windows venvs created
*inside* it hit the long-path limit — **create the venv at a short path outside
the project**:

```bash
py -m venv ~/otoscout-venv
~/otoscout-venv/Scripts/python -m pip install -r pipeline/requirements.txt

# Danish Superliga 2025/26 (fetch.py auto-registers the league with soccerdata)
~/otoscout-venv/Scripts/python pipeline/fetch.py --league DEN-Superliga --season 2025-2026
```

First run scrapes FBref (slow — cold browser + rate limit); re-runs hit
soccerdata's local cache.

### 2. Run the app (Node ≥ 22 for `node:sqlite`)

```bash
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
