# 2026-07-02 — Shortlist-motor + watch lists

En hel ny gren: fra "kig på data" til "find navne og følg dem". Bygger direkte
oven på similaritet + cross-league + fit-motoren ([[2026-07-01-scouting-buildout]],
[[2026-07-01-holdrapport-og-heatmaps]]) og gør applikationen til et egentligt
rekrutteringsværktøj.

## 1. Shortlist-motoren (`/shortlist`)

Ny navbar-tab. Du bygger en søgeprofil og får en rangeret liste på tværs af alle
16 ligaer — det er selve scouting-arbejdet, ikke bare analyse omkring data.

- **Filtre**: position (GK/DF/MF/FW), maks alder, min. minutter, liga.
- **Stat-krav på percentil**: tilføj N krav ("Vellykkede driblinger ≥ 70",
  "xA ≥ 60"). Percentil frem for absolut værdi, så en tærskel betyder det samme
  i POR som i FIN. De valgte metrics bliver automatisk tabellens kolonner.
- **Rangering**: OUT-score · match-score (gennemsnit af de krævede percentiler) ·
  eller **lighed til en template-spiller** ("ligner som" — søg og vælg). Auto
  vælger fornuftigt (template → lighed, ellers krav → match, ellers OUT).
- **Alt klient-side** fra ét cached payload (`lib/shortlist.ts`, ~4100
  kvalificerede spillere med per-90 + percentiler + bio), så filtreringen er
  øjeblikkelig. Celler heat-tones efter percentil; klik åbner spillerkortet.

Verificeret: "U23, MF/FW, dribl ≥70 & xA ≥60" gav præcis de rigtige unge kanter
(Kadile, Godts, 17-årige Karetsas).

## 2. Watch lists

Navngivne, gemte spillerlister — den anden halvdel af grenen.

- **Persistering**: `data/watchlists.json` (scouting.db er read-only, så lister
  bor i deres egen skrivbare fil). Entries keyer på `sofascore_id`, så de
  **overlever månedlig re-ingest** (spiller-nøgler ændrer sig ved transfers).
  IKKE gitignored — du kan selv committe filen som backup.
- **Backend**: `lib/watchlists.ts` + `/api/watchlists` (GET alle · POST én
  mutation: create/rename/delete/add/remove).
- **Client-store**: delt modul-state (`components/watchlist.tsx`) — ét fetch ved
  første brug, mutationer POST'er og broadcaster frisk state til alle mounts.
- **⭐-knap tre steder**: shortlist-rækker, spillerkortet, og database-tabellen
  (`/board`). Popover til at vælge/oprette liste — renderet i en **portal med
  fixed positionering**, så den ikke klippes af tabellernes overflow-container.
- **Watchlists-fane** på shortlist-siden: hver liste med live-stats (genberegnet
  mod nyeste data via sid-opslag), omdøb/slet, fjern spillere.

## Detaljer / faldgruber

- **Client-safe metadata**: `lib/shortlist.ts` importerer node:fs, så metric-
  grupperne blev flyttet til `lib/shortlist-metrics.ts` (ren data) som både
  serveren og klient-UI'et deler.
- **Popover-placering**: åbnede først ud i sidens lyse venstremargin (lys-på-lys,
  nærmest usynlig). Nu ankres venstrekanten til stjernen og åbner mod højre over
  tabellen; vender opad hvis den ellers løber ud under skærmkanten.
- **Payload-størrelse**: `/shortlist` er ~5,6 MB ukomprimeret (mange metrics ×
  4100 spillere). Loader fint og komprimeres kraftigt i prod; kan trimmes til
  array-rækker hvis det bliver et problem.

## Berørte filer

```text
app/shortlist/page.tsx           NY — shortlist-siden (server → ShortlistView)
components/shortlist-view.tsx     NY — filtre, rangering, template, watchlist-fane
lib/shortlist.ts                  NY — cached payload (percentiler + per90 + bio)
lib/shortlist-metrics.ts          NY — client-safe metric-grupper + sim-nøgler
lib/watchlists.ts                 NY — JSON-persisteret liste-store + mutationer
app/api/watchlists/route.ts       NY — GET alle / POST én mutation
components/watchlist.tsx          NY — client-store + ⭐ WatchlistButton (portal)
components/player-table.tsx       + ⭐ i database-tabellen
components/player-modal.tsx       + ⭐ i spillerkortets header
components/site-header.tsx        + Shortlist nav-tab
lib/similar.ts                    PlayerDetail bærer nu sid (stabilt id)
```
