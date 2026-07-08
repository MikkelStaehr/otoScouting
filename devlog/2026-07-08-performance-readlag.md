# 2026-07-08 — Performance: read-laget (17s → 2s kold)

Med 30 ligaer var den første sideindlæsning blevet smertefuld: den kolde
cross-league-pulje tog **17 sek**, og den fulde pulje (til similaritet/værdi-spænd)
**21 sek**. Den varme cache var fin (0 ms), men man ramte den kolde sti efter hver
ingest, config-tweak eller server-genstart. Målt og fjernet, tre trin:

## 1. Memoisér navne-matchningen (O(n²) → O(n))

`matchSofascore` (FBref↔Sofascore, og genbrugt til Transfermarkt) genberegnede den
dyre `normName()` (regex + Unicode-NFD) i den indre O(fb × so)-løkke — samme navne
blev normaliseret tusindvis af gange. Pre-normalisér hver Sofascore-kandidat **én
gang** (navn, tokens, token-set) og score mod det. → 17s → ~5s.

## 2. Cache `prepareRows` pr. (liga, sæson)

Den tunge forberedelse (matchning + stint-merge) blev kørt for de samme dev-ligaer
i *både* dev-puljen og den fulde pulje. Cachet på data-versionen, så begge deler den.
Callers muterer ikke rækkerne (cross-league-dedup kloner nu i stedet for at mutere
`season_teams`). → fulde pulje 5,8s → 1,8s; enkelt-liga board 724ms → 36ms.

## 3. Load forrige snapshot ÉN gang

`previousSofascore` (Δ vs sidste hentning) blev kaldt **pr. liga** (30×), og
aggregerede hver gang `MAX(snapshot_id)` + scannede hele den ~28k-rækkers
history-tabel. Load hele det forrige snapshot én gang, grupperet pr. liga, cachet.
→ ~5s → 2,1s.

## Resultat

| | Før | Nu |
|---|---|---|
| Cross-league (kold) | 17.000 ms | 2.100 ms |
| Full-pool (kold) | 21.000 ms | 1.200 ms |
| Enkelt-liga board | 724 ms | 36 ms |
| Varm cache | — | 0 ms |

Al korrekthed intakt: match-rater uændrede, Δ virker (6.671 spillere), transfer-dedup
uændret (0 sid-dubletter, Teuma-stints bevaret).

## Tilbage: payloadet

"Alle ligaer" sender stadig ~27 MB til browseren (11.651 spillere × alle felter) —
langsomt at serialisere + hydrere. Næste optimering (separat: trim felter / array-
rækker / server-filtrering).

## Berørte filer

```text
lib/merge.ts     pre-normaliserede kandidater (Cand) + scoreCand — O(n) matchning
lib/players.ts   preparedRows-cache; loadPrevSnapshot (én gang, pr. liga); dedup kloner
```
