# 2026-07-02 — Polish + datamodel: keepere, zoner, database-split, transfer-merge

En batch af smårettelser der endte med at røre kernedata. Byggede oven på
rekrutteringsgrenen ([[2026-07-02-shortlist-watchlists]], [[2026-07-02-radar-compare]])
og løste to reelle datamodel-problemer på vejen.

## 1. Keeper-datakombination (sweeper vs. boldspillende)

Percentiler er pool-opdelte — markspillere rankes mod markspillere, målmænd mod
målmænd. Derfor var en keepers pass%/afleverings-percentil **null** (ikke i
markspiller-puljen), og man kunne ikke filtrere/analysere keepere på opspil.

- `KEEPER_BUILDUP`-sæt (pass%, passes, lange bolde, long-ball%, F3P): keepere får
  nu en **keeper-vs-keeper** percentil på disse. F3P/90 spænder 0,3→4,6 på tværs
  af keeperne — nok til at skelne begrænset / boldspillende / sweeper.
- `passes` + `long_balls` tilføjet shortlist-filtrene; keeper-modalen viser nu
  Opspil-gruppen.

## 2. Zoneanalyse (spiller + hold)

Sæson-heatmap-griddet aggregeret til **3×3 zoner** med andel af aktivitet pr.
zone — et kvantificeret "hvor opererer han/holdet". Ærlig scope: det er
berøringsfordeling, ikke per-handling (afleveringer/tacklinger/skud pr. zone
kræver kamp-events vi ikke henter). Delt `components/zone-pitch.tsx`, vist under
heatmappet i spiller-modalen og hold-rapporten.

## 3. Database splittet + flyttet til højre

- **Table of Justice** (/board) = den polerede, sorterbare, filtrerbare tabel.
- **Raw DB** (/database) = tæt tabel med alle rå-kolonner, kolonne-sortering,
  søgning og **CSV-eksport** af den aktuelle visning.
- Begge indgange flyttet til højre i navbaren ved siden af søgefeltet; venstre
  nav er nu Spillere / Hold / Shortlist.

## 4. Liga-filter på Spillere-siden

Ét side-niveau filter scoper hele siden (scatter + top-lister) til én liga eller
alle (default). Erstatter scatterens egen liga-dropdown.

## 5. Transfer-stints slået sammen (datamodel)

En vinter-handel viste spilleren to gange (Mads Emil Madsen som AGF *og* FCK).
Nøglen var et ikke-oplagt datamønster:

- FBref splitter tælle-stats korrekt pr. klub (AGF 607′/0 mål, FCK 1456′/3 mål).
- Sofascore serverer **hele sæsonen på én række** (nuværende klub), som fuzzy-
  matcheren hæfter på *begge* stints — samme xG/passes på hver.

`mergeStints` (i prepareRows, efter Sofascore-merge, før berigelse): grupér på
normaliseret navn i en liga-sæson, **summér FBref-tællinger**, **tag Sofascore-
blokken én gang** (ellers dobbelttælles xG), genberegn keeper-save% fra summerede
skud. Nuværende klub = den stint hvis hold matcher Sofascores klub; `season_teams`
gemmer kæden (nuværende først), vist i modalen som "(tidl. AGF)". Guard: 2+
forskellige sofascore-id'er i en navnegruppe = forskellige personer → merges ikke.
**181 dublet-grupper → 3** ægte navnesammenfald (almindelige portugisiske navne).

## 6. Diverse

- Fjernet "hvor han er på banen over sæsonen"-teksten under heatmappet.

## Berørte filer (udvalg)

```text
lib/model.ts              KEEPER_BUILDUP — keeper-vs-keeper opspils-percentiler
lib/players.ts            mergeStints + mergeGroup (transfer-stints → én række)
lib/types.ts              RawPlayer.season_teams
lib/raw-data.ts           NY — rå-payload til Raw DB (alle kolonner)
components/raw-database.tsx  NY — tæt tabel + sortering + CSV-eksport
app/database/page.tsx     NY — Raw DB-siden
components/zone-pitch.tsx  NY — 3×3 zoneanalyse-bane (delt)
components/dashboard-view.tsx  side-niveau liga-filter
components/site-header.tsx  Database → højre, splittet i to
lib/shortlist-metrics.ts  + passes/long_balls i Opspil
lib/similar.ts / player-modal.tsx  keeper-opspil + "(tidl. …)"-kæde
```
