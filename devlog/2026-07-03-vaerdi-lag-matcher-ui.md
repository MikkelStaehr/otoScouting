# 2026-07-03 — Værdi-laget (Fase 2-4): matcher + UI

Fortsættelse af [[2026-07-03-vaerdi-lag-transfermarkt.md]] (dataen). Her kobles
markedsværdien på spillerne og vises i appen — value-per-output er nu live.

## Fase 2 — matcher (genbrug frem for nybyg)

Transfermarkt-spillere skal matches til vores spillere (andre ids, let forskellige
navne/hold-stavemåder) — nøjagtig samme problem som FBref↔Sofascore. Nøgle-indsigt:
`matchSofascore` er allerede generisk (`<T extends {player, team}>`), så ved at
aliasse TM's `name`→`player` **genbruger vi den eksisterende matcher direkte** —
ingen ny fuzzy-logik.

- `lib/transfermarkt.ts` — loader der læser `transfermarkt_players` for en
  (liga, sæson) i `{player, team, market_value, tm_id, …}`-form.
- `players.ts prepareRows`: efter `mergeStints` (så en transfer ikke dobbelt-tæller
  værdien) matches TM og `market_value` + `tm_id` hægtes på hver spiller-række.
- `RawPlayer`/`EnrichedPlayer` bærer nu `market_value`, så den flyder til **både**
  enkelt-liga- og cross-league-boardet gratis.
- **Match-rate 86-93%** (på niveau med Sofascore-merge'en). Umatchede får "—".

## Fase 3-4 — model + UI

Værdi-per-output er bare `OUT ÷ markedsværdi` — ingen ny model-kolonne nødvendig;
værdien lever på spilleren, og UI'et lader dig sortere på den.

- **Værdi-kolonne** i begge spiller-tabeller (overview: i Stamdata; stat-tabel: ved
  siden af OUT, så value-per-output-parringen læses samlet). Sorterbar.
- **Værdi-chip** i spillerkortets header (`getPlayerDetail` bærer `marketValue`).
- `fmtValue` viser kompakte euro (€350k / €1.2m / €12m).
- **Kup-visningen** falder ud gratis: sortér Værdi stigende blandt høj-OUT-spillere
  → undervurderede profiler.

## Verifikation

`tsc` rent. Tabellen renderes client-side, så `market_value` blev bekræftet til stede
i den serialiserede board-data for alle 536/536 FRA-spillere (med rigtige tal + tm_id).
Sanity: undervurderede-listen fisker korrekt høj-OUT/lav-værdi frem.

## Næste (forfininger, ikke blokerende)

- Dedikeret alders-filtreret "kup"-liste (U23) så toppen er prospekts, ikke billige veteraner.
- Værdi-historik-sparkline (TM har den) → binder ind i [[2026-07-02-radar-compare]]-sporet
  og det kommende trend-lag.
- Løn-bonus (Capology) for de ~10 vestlige ligaer.
- Værdi-kolonne i shortlist + Raw DB.

## Berørte filer

```text
lib/transfermarkt.ts       NY — TM-loader formet til matchSofascore
lib/players.ts             prepareRows hægter market_value + tm_id på (efter mergeStints)
lib/types.ts               RawPlayer + market_value, tm_id
lib/similar.ts             PlayerDetail + marketValue
components/player-table.tsx  Værdi-kolonne (begge tabeller) + fmtValue + sortering
components/player-modal.tsx   værdi-chip i kort-headeren
```
