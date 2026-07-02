# 2026-07-02 — Polish: hold-rapport, rolle-kalibrering, akse-fix

Finpudsning efter hold-rollerne ([[2026-07-02-hold-roller]]) — oprydning, et par
data-fejl fanget i brug, og en klassisk koordinat-forveksling.

## PSV havde ingen spiller-data

PSV-rapporten viste stats/stil/formation men tom trup/zoner/positioner/roller: den
klikkede "PSV Eindhoven" (Sofascore) vs "PSV" (FBref) deler kun 3-tegns-ordet "psv",
under vores ≥4-guard. Tilføjede et **subset-match** (det korte navns ord fuldt
indeholdt i det lange) mellem eksakt- og overlap-trinnet — "PSV" ⊆ "PSV Eindhoven",
"AZ" ⊆ "AZ Alkmaar", "Sparta R." ⊆ "Sparta Rotterdam". Ramte sikkert flere korte
klubnavne der stille manglede spiller-laget.

## Rapport ryddet op

Forsvarszoner var blevet redundant med Roller-tabben, så den røg — og det ryddede
op i den tætte Rapport: nøgletal til venstre, opstilling/heatmap + zoneanalyse rykket
over i den frigjorte højre kolonne. Trup-tabellen: faste ledende kolonner (spiller /
rolle / kampe) via `table-fixed` + `colgroup`, så de flugter på tværs af kæde-
tabellerne. Opgradér-mål = svageste rolle **pr. kæde** (GK/CB/BACK/MID/WIDE/STRIKER),
så rekruttering spænder over hele banen, ikke kun det værste område.

## Rolle-kalibrering: brede backs var Stoppere

Buta og Meling (brede wing-backs) blev klassificeret som Stoppere — de centrale
CB-roller belønnede tacklinger uden at kræve central placering, og en defensivt
aktiv back tackler også meget. Data bekræftede det (Meling cy=0.73, Buta cy=0.17,
begge lave luftdueller). Tilføjede et **centralitets-signal** (invers-wide) til de
centrale CB-roller og gjorde Wide CB **luft-domineret**. Nu: Meling→Pressing Full-
Back, Buta→Attacking Wing-Back, mens rigtige CB'er (Otamendi/Chukwudi/Suzuki) bliver.

## Bredde-aksen var spejlvendt

Brugeren fangede at venstre/højre var byttet om. Bekræftet med kendte venstre-
spillere (Godts, Achouri, Meling, López — alle høj cy = bunden hos os): Sofascores
y-akse vender **modsat** broadcast-konventionen. Spejlvendte bredde-aksen i alle tre
baner (heatmap-rækker, zoneanalyse-rækker, opstillings-prikker) → venstre flanke i
toppen med angreb mod højre. **Rent visuelt** — rollerne bruger symmetrisk `|cy-0.5|`,
så data og roller er upåvirkede.

## Berørte filer

```text
lib/team-report.ts        subset-match (korte klubnavne) + opgradér pr. kæde
lib/roles.ts              centralitets-signal på CB-roller; Wide CB luft-domineret
components/team-modal.tsx  fjern Forsvarszoner, ryd Rapport, flugtende Trup
components/pitch-heatmap.tsx / zone-pitch.tsx / formation-pitch.tsx  spejlvend bredde
```
