# 2026-07-01 — Holdrapport, heatmaps og skarpere dashboard

Efter fundamentet ([[2026-07-01-scouting-buildout]]) blev holdsiden løftet fra en
smal "svageste back"-boks til et rigtigt dossier, spiller- og hold-modalerne blev
desktop-brede, scatteren fik statistisk kontekst, og både spiller- og hold-heatmaps
er nu på plads.

## 1. Klikbare hold + elegant liga-vælger

- **Hold i databasen er nu klikbare** (`/board` → Hold) — åbner samme rapport som
  på dashboardet. Virkede før kun fra forsiden.
- **Liga-vælgeren** gik fra ~17 wrappende knapper til én ren dropdown ("Liga" +
  `<select>` med "⚑ Alle ligaer" nederst). Sæson-toggles kun når en liga har flere.

## 2. Fuld holdrapport (ikke bare svagheder)

`lib/team-report.ts` komponerer nu et helt dossier i stedet for bare zone-svagheder:

- **KPI-stribe** med ligaplacering pr. nøgletal (Rating, Mål, xG, Mål imod, Store
  chancer imod, Clean sheets — hver som "11. af 12").
- **Auto-udledte styrker/svagheder** fra percentiler (Silkeborg: styrker Pass%/
  Dueller%, svaghed Store chancer imod 12/12 — forklarer *hvorfor* backene trækkes
  ud: holdet lækker chancer defensivt).
- **Offensive + defensive nøgletal** som bars med værdi + placering.
- **Forsvarszoner + fit-forslag** (den eksisterende motor) ved siden af.

## 3. Trup-tabel + tabs

Holdmodalen fik **"Rapport"/"Trup"-tabs** (rapporten blev for lang som ét scroll)
og en **spillertabel grupperet efter kæde** (Målmænd/Forsvar/Midtbane/Angreb):

- Positions-relevante nøgletal pr. 90 (Angreb: mål/xG/assist/skud/chances/dribl;
  Midtbane: assist/xA/chances/pass%/dribl/generobringer; Forsvar: tklr/erob/clear/
  luft/duel%; Målmænd: clean sheets/save%/goals prevented).
- **Kampe + minutter/kamp stablet** i én kolonne (min/kamp, ikke summerede minutter
  — viser hvor længe hver spiller reelt er på banen).
- **Flag + OUT-score** pr. spiller. Celler heat-tonet efter percentil.
- Modal udvidet til `max-w-7xl`; spiller-modal til `max-w-4xl` (vi scouter på desktop).

## 4. Elegant heatmap → delt komponent → hold-heatmap

- **Redesign**: de hårde ensfarvede firkanter blev til en blød farveramp (bleg →
  rav → clay → dyb rød) med Gaussisk blur, så det grove 12×8-grid læses som bløde
  blobs. Afrundet clip + tyndere banemarkeringer.
- **Udtrukket** til delt `components/pitch-heatmap.tsx` (`PitchHeatmap`), genbrugt af
  begge modaler — ét sted for designet.
- **Hold-composite-heatmap** (`getTeamHeatmap`): Sofascores *hold*-heatmap 404'er, så
  vi UDLEDER det — summér hver markspillers sæson-grid vægtet efter spilletid,
  renormalisér (målmænd ekskluderet). Ingen ny hentning; bruger `player_heatmaps`.
  Vist i Rapport-tabben som "hvor holdet opererer".

## 5. Scatter + top-lister: skarpere aflæsning

- **Nul-akse-prikker droppes** (0 på X eller Y = "gjorde det ikke", bare kant-støj).
- **Median-kryds**: lodret (X) + vandret (Y) referencelinjer, hver navngivet med sin
  dataværdi ("median xG /90: 0.24") → fire kvadranter for over/under på begge metrics.
- **Kontekstuel forklaringsboks** der beskriver de valgte X/Y-akser (AXIS_DESC),
  y=x-diagonalen og medianerne — opdaterer live. Erstatter den statiske tekst.
- **Tooltip med kampe + minutter** så per-90 kan vejes mod sample-størrelse.
- **Top-lister**: navn/klub/liga·position stablet, faste kolonnebredder → tallene
  flugter uanset navnelængde.

## 6. Bugfix: holdrapport-404 fra navne-mismatch

Klikkede holdnavne er Sofascore-stavede ("Red Bull Salzburg", "SV 07 Elversberg"),
men spillerrækkerne bruger FBref ("RB Salzburg", "Elversberg") — så svaghedsmotoren
fandt nul spillere og hele rapporten faldt til `null` (404 på mange klubber).

- **`resolvePlayerTeam`**: eksakt normaliseret match, ellers distinktiv-token-overlap
  ("salzburg", "elversberg") for at bygge bro mellem de to stavemåder.
- **Rapport afkoblet fra svaghedsmotoren**: viser hvad der findes (holdstats *eller*
  trup *eller* zoner); 404 kun hvis absolut intet matcher.

## Berørte filer (udvalg)

```text
lib/team-report.ts              NY — holddossier: rank, styrker/svagheder, trup, heatmap
lib/heatmap.ts                  + getTeamHeatmap (minut-vægtet composite)
components/team-modal.tsx       tabs (Rapport/Trup), trup-tabel, KPI'er, heatmap
components/pitch-heatmap.tsx    NY — delt elegant pitch (blur + farveramp)
components/player-modal.tsx     bredere; genbruger PitchHeatmap
components/scatter-dashboard.tsx  nul-filter, median-kryds, tooltip, forklaringsboks
components/top-lists.tsx        stablet meta + position, flugtende kolonner
components/board-switch.tsx     liga-dropdown
components/team-table.tsx       klikbare hold
lib/scatter-axes.ts             + AXIS_DESC (akse-forklaringer)
app/api/team/route.ts           returnerer fuld TeamReport
```
