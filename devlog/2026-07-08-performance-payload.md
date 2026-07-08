# 2026-07-08 — Performance: "Alle ligaer"-payloadet + render

Efter read-laget ([[2026-07-08-performance-readlag]]) var den ene tunge sti tilbage:
"Alle ligaer"-boardet var **60 MB / 7,8s** — det sendte alle 11.651 spillere × alle
felter og renderede 8.000 DOM-rækker. To client-side fixes.

## 1. Kun kvalificerede i cross-league

Cross-league er prospekt-finderen, så send kun kvalificerede spillere (≥ minMinutes):
11.651 → 8.016 spillere, **60 → 41 MB (-31%)**. Bonus: det fjerner de 2-minutters-
småsample-spillere med OUT=100 der proppede toppen. Enkelt-liga boards beholder hele
truppen (ukvalificerede vist nedtonet).

## 2. Windowing (render kun de synlige rækker)

`PlayerTable` renderede *alle* rækker i DOM'en — 8.000 for cross-league. Nu renderes
de første 150, og en sentinel (`IntersectionObserver`, 800px margin) under de
renderede rækker vokser vinduet med +200 efterhånden som man scroller. En ny
sortering/filter nulstiller til toppen. → SSR-HTML gik fra 8.000 til 150 rækker.

## Resultat

| | Start | Nu |
|---|---|---|
| Tid (varm) | 7,8s | 4,1s |
| Payload | 60 MB | 21,6 MB |
| Renderede DOM-rækker | ~8.000 | 150 (+scroll) |

Kombineret med read-laget: **"Alle ligaer" fra ~25s (kold) til ~4s**, og scroll/
interaktion er nu rap (150 rækker i DOM'en, ikke 8.000).

## Tilbage: kompakt encoding

De resterende ~21 MB er RSC-flight-data (alle 8.016 spilleres props til klient-side
sortering/filtrering). ~Halvdelen er *gentagne metrik-nøgler* (`big_chances_created`
× 8.016 × 2). Kolonne-arrays i stedet for objekter → ~21 → ~11 MB. Næste (og sidste)
optimering.

## Berørte filer

```text
app/board/page.tsx          kvalificeret-filter for cross-league
components/player-table.tsx  windowing (renderLimit + sentinel + IntersectionObserver)
```
