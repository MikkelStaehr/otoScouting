# 2026-07-03 — Dublet-spillere: to slags, én nøgle

Bruger-rapport: "Bar Lin" og "Bar Enosh Lin" gik igen. Det afslørede to *forskellige*
dedup-problemer — begge løst via det stabile **Sofascore-id** frem for skrøbelig
navne-match.

## 1. FBref dobbelt-listning (inden for én liga)

FBref lister nogle gange samme spiller to gange ved samme klub under to navnevarianter
med splittede stats: "Bar Lin" (742 min, 1 mål) + "Bar Enosh Lin" (968 min, 2 mål) —
begge Kryvbas, begge samme Sofascore-spiller (id 1176771). `mergeStints` grupperede kun
på normaliseret navn, så de forblev to rækker.

**Fix:** `mergeStints` omskrevet til **union-find over to nøgler** — samme normaliserede
navn (en transfer-stint; FBref beholder ét navn på tværs af klubber) ELLER samme non-null
Sofascore-id (en dobbelt-listning). Id-signalet er pålideligt hvor navne-heuristik er
farlig: "Manu Vallejo" (69 min) vs "Vallejo" (2880 min) ved Ceuta er **forskellige**
spillere og forbliver korrekt adskilt (forskellige ids). En navne-subset-regel ville have
slået dem sammen. `season_teams` deduperes nu også, så en samme-klub-merge ikke læses som
en transfer.

## 2. Cross-league transfers (mellem to af vores ligaer)

En anden sag, fanget af samme optælling: 261 spillere delte et Sofascore-id på tværs af
*to* ligaer — ægte midtsæson-transfers mellem vores 29 ligaer (Teddy Teuma FRA/Reims ↔
BEL/Standard; Kristall Máni Ingason NOR/Brann ↔ DEN/SønderjyskE). Ikke en bug, men på
"Alle ligaer"-boardet fyldte de to rækker i rangeringen.

**Beslutning (bruger):** fold til **primær liga**. `computeCrossLeaguePlayers` deduperer nu
på Sofascore-id efter pooling — beholder stinten med **flest minutter**, og folder den anden
klub ind i `season_teams` (så kortet stadig viser "(tidl. …)"). Cross-league: 11.007 → 10.746
rækker, 0 resterende id-dubletter. Percentil-puljen tæller nu hver spiller én gang (mere korrekt).

## Hvorfor id og ikke navn

Begge fixes hviler på at Sofascore-id'et er stabilt og globalt unikt. Navne-lighed er
tvetydig (fornavne deles, mellemnavne tilføjes/droppes); id'et siger utvetydigt "samme
person". Det er samme princip som `mergeStints`' eksisterende guard ("2+ id'er i en
navnegruppe = forskellige personer").

## Berørte filer

```text
lib/players.ts   mergeStints → union-find (navn ELLER sid) + dedup season_teams;
                 computeCrossLeaguePlayers → fold multi-liga-spillere til primær liga
```
