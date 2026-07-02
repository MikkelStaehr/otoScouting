# 2026-07-02 — Formationer, positionering, faser og filtre

Den spatiale/taktiske etape oven på datamodel-batchen ([[2026-07-02-polish-datamodel]]):
holdene fik formationer, en positionerings-bane med angreb/forsvar-split, og
dashboardet fik nationalitets-filter + liga/flag-ikoner.

## 1. Formationer pr. hold

Formationer ligger i hver kamps lineup (ikke i sæson-aggregater), så `pipeline/
fetch_formations.py` går sæsonens kampe igennem én gang, læser begge holds
formation fra `/event/{id}/lineups` og tæller op pr. Sofascore-team-id i
`team_formations`. Vist som chips i holdrapporten (Benfica 4-2-3-1 85% / 4-4-2 9%).
**16 ligaer · 260 hold** dækket. Pipelinen er hærdet (`.catch` på in-browser
fetch + per-liga try/except) så ét blip ikke vælter kørslen.

## 2. Ingest samlet + sæson-akkumulering

`ingest.py` kører nu **fem trin**: koefficienter → Sofascore → FBref → heatmaps →
formationer. Flags `--spatial-only` / `--no-spatial` styrer de tunge browser-
scrapes. Alle tabeller er nøglet på `season`, så august-planen holder: pej
registry på sidste sæson → kør ingest → data lagres side om side til at sammenholde
på tværs af år.

## 3. Opstilling & spillere over heatmappet

I stedet for at tvinge spillere ind i abstrakte formations-slots (vores grove
positionsdata rækker ikke) tegnes hver spiller på sin **rigtige gns. position**
fra heatmap-centroiden — prik farvet efter **OUT** (grøn = spillet bedst, clay =
dårligst), størrelse efter spilletid, sæson-heatmappet svagt bagved, formationen
som label. Begrænset til den **typiske 11'er** (mest spilletid). Prikkerne åbner
spillerkortet. Prospect/upgrade-forslagene i forsvarszonerne blev fjernet for at
give luft (kommer igen når laget omarbejdes).

## 4. Angreb vs. forsvar (fase-split)

**Samlet / Angreb / Forsvar**-toggle både på holdets opstilling og på spillerens
heatmap. Vi henter ikke ægte in/out-of-possession-data, så det er en **ærlig
approksimation**: hver celle vægtes efter dybde (×dybde = angreb, ×(1−dybde) =
forsvar) og normaliseres. Backs skyder højt op i angreb og falder dybt i forsvar;
målmænd flytter sig knap. Delt `reweightGrid` + `getSquadCentroids` (att/def-
centroider). Teksten gør opmærksom på at det er afledt, ikke ægte faser.

## 5. Nationalitets-filter + ikoner

- **Spillere-siden** fik et nationalitets-filter ved siden af liga-filteret (kun
  spillere), der scoper hele siden. `nat` tilføjet dashboard-payloadet.
- Ny **IconSelect** (native `<select>` kan ikke vise ikoner): custom dropdown med
  flag pr. række + søgning ved mange (129 nationer). Driver liga- + nationalitets-
  filtrene og board'ets liga-vælger.
- **Liga-ikon = landeflag** (hver liga er et distinkt land). Flag i liga-dropdowns,
  database-liga-chippen og hold-listerne. Delt `leagueLabel` i `lib/league-meta`.
- Fix: top-listerne viste **ligaens** flag under spilleren (en dansker i Sverige
  fik svensk flag) — nu vises spillerens egen nationalitet, ligaen som tekst.

## Berørte filer (udvalg)

```text
pipeline/fetch_formations.py   NY — formationer fra kamp-lineups
pipeline/ingest.py             + heatmaps/formations trin, --spatial flags
lib/formations.ts              NY — top-formationer pr. hold
lib/heatmap.ts                 getSquadCentroids (+ att/def centroider)
lib/team-report.ts             formations + positions (PlayerDot)
components/formation-pitch.tsx NY — opstilling over heatmap + fase-toggle
components/pitch-heatmap.tsx   reweightGrid (fase-vægtning)
components/icon-select.tsx     NY — dropdown med flag-ikoner + søgning
lib/league-meta.ts / lib/flags.ts  leagueLabel + leagueFlagUrl
components/dashboard-view.tsx  nationalitets-filter + IconSelect
components/team-modal.tsx / player-modal.tsx  fase-toggles
```
