# 2026-07-01 — Fra datafundament til rigtigt scouting-værktøj

Den store etape: 16 ligaer i drift, et dashboard, dyb data-mining, spiller-
similaritet og fuld logo-dækning. Det binder fundamentet ([[2026-07-01-league-registry]],
[[2026-07-01-cross-league]]) sammen til noget man faktisk scouter i.

## 1. De 16 ligaer i drift

Registryet var på plads; nu skulle data ind. Sofascore (hold + xG) for alle 16
gik glat. FBref (spillere) var seigt:

- **3 forkerte FBref-navne** gav `ValueError: No objects to concatenate` (tom
  hentning). soccerdata matcher på FBrefs *præcise display-navn* — fundet ved at
  grep'e `~/soccerdata/data/FBref/leagues.html`: "EFL Championship" (ikke
  "Championship"), "2. Fußball-Bundesliga", "Austrian Football Bundesliga".
- **FBref hænger/throttler** på de store ligaer. Løst med per-liga timeout +
  retry-runder i `ingest.py` (én dårlig liga vælter ikke resten, prøves igen).
- **Resultat: 14/16 ligaer med spillere** (~6300). POL = soccerdata-parsebug på
  standard-tabellen; ISL = FBref har ingen islandsk liga. Begge kører Sofascore-
  only (hold + xG, ingen spiller-rygrad).
- **WAL-mode** på databasen så app-læsning og ingest-skrivning ikke blokerer
  hinanden (en tidlig ingest døde pga. en DB-lås).

## 2. Dashboard (forsiden)

`/` er nu et **dashboard** ("Europa-overblik"), databasen flyttet til `/board`.
OTO-filosofien (1:1, ingen top-5) er indbygget: vores 16 ligaer ER de producerende
outsider-ligaer.

- **Scatter** (dependency-frit SVG): vælg X og Y (mål/90 vs xG/90 osv.), spiller/
  hold-toggle, liga-filter, søg-og-highlight, y=x-referencelinje, auto-navngiv af
  dem der stikker ud. Bundet til skærmhøjden så den ikke sprawler.
- **12 klikbare top-lister**: målfarlige, output, U21-prospekts, chance-skabere,
  store chancer, driblere, uforløst (xG−mål), boldgenerobrere, tacklemaskiner,
  luftdominans, afleverings-mestre, målmænd. Klik en kasse → hele listen (modal).
  Klienten beregner alt fra ét kompakt datasæt → øjeblikkeligt.
- **Live status-panel** i Indstillinger — spillere/hold/xG pr. liga, poller mens
  en ingest kører.

## 3. Data-mining: forsvar + skabelse (den store gevinst)

Vi hentede en fuld Opta-stil datasæt fra Sofascore men brugte kun xG/xA/goals-
prevented. **Resten lå ubrugt.** To berigende grupper tilføjet — ingen ny hentning,
bare merge det vi allerede havde:

- **Forsvar** (før: kun interceptions + tackles vundet): + clearances, blocks,
  ball recovery, high-press-erobringer, luftdueller, duel%, fejl→skud (inverteret).
- **Opspil** (ny): afleverings% (100% dækket), lange bolde + long-ball%, final-
  third-afleveringer, total afleveringer.
- **Skabelse** (ny): chances created (key passes), store chancer skabt, vellykkede
  driblinger, præcise indlæg.

Nu lyser en central forsvarsspiller eller en ren kreatør grønt på de rigtige
metrics i stedet for at se tom ud fordi han ikke scorer.

## 4. Spiller-profil + statistisk similaritet

Klik en spiller (top-lister, scatter-prikker, database-tabel) → modal med:

- **Fuld percentil-profil** — alle dimensioner med farvede bars.
- **"Ligner statistisk"** — de mest stats-ens spillere, beregnet som afstanden
  (RMSE) mellem percentil-profil-vektorer (allerede 0-100 og ligastyrke-justeret),
  samme rolle, på tværs af alle ligaer. Klik en tvilling → hop til hans profil.
  Det gør cross-league scouting konkret: en Championship-angriber → en 20-årig
  lookalike i Portugal med 93% lighed.

**Cache**: cross-league-boardet caches nu nøglet på DB/config-mtimes. Første
spiller-klik bygger det (~4s), derefter ~0,1s. App-åbninger er cachede reads
indtil næste ingest — løser den gamle "preload hver gang"-bekymring.

## 5. Fuld logo-dækning (100%)

ESPN dækkede kun 11/16 ligaer. Hvert hold har et `sofascore_team_id`, men
Sofascores billeder er Cloudflare-låst (403 til plain requests OG botasaurus
`@request`). **De virker gennem en rigtig browser:** `fetch_logos.py` besøger
sofascore.com (består udfordringen), henter så hvert crest via in-page
`fetch().then(blob→dataURL)` (run_js pakker i en ikke-async IIFE med
`await_promise=True`, så promise-kæde, ikke top-level `await`), og gemmer til
`public/logos/sofascore/{id}.png`. Navn→id-map dækker FBref + Sofascore-stavemåder
+ 10 forkortelses-aliaser (QPR, BTSV, Hearts…). **260 crests, 100% dækning**,
self-hosted, ingen runtime-afhængighed.

## Berørte filer (udvalg)

```text
app/page.tsx / app/board/page.tsx   dashboard-forside + database flyttet
components/scatter-dashboard.tsx    X/Y-scatter (klikbare prikker)
components/top-lists.tsx            12 klikbare leaderboards + hele-listen-modal
components/player-modal.tsx         NY — profil + similaritet
components/settings-modal.tsx       live data-status
lib/similar.ts                      NY — percentil-profil-similaritet
lib/players.ts                      cross-league cache (mtime-nøglet)
lib/types.ts / lib/metrics.ts       + forsvars/opspil/skabelses-metrics
config/model.json                   berigede grupper (defensive/buildup/creation)
lib/scatter-axes.ts                 + defensive/kreative akser
pipeline/fetch_logos.py             Sofascore-crests via browser-bypass
pipeline/ingest.py                  FBref timeout + retry-runder
config/leagues.json                 rettede FBref-navne
lib/team-logos.ts                   self-hosted lokale crests
```
