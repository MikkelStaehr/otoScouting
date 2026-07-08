# 2026-07-08 — Big-5 som benchmark-tier + log-ankret styrke

Bestillingen vendte et bevidst designvalg: OTO var "ingen top-5" (de 29 var
*producent-ligaerne*). Men et udviklingslag betyder ingenting hvis man ikke måler
det mod virkeligheden — og virkeligheden er at 4-5 ligaer er markant stærkere. Så
big-5 kom ind, men som et **distinkt benchmark-tier**, ikke bare 5 ligaer mere.

## Model B: to adskilte spørgsmål

Nøgle-indsigten: *hvad anker styrke-skalaen* og *hvad er i scouting-puljen* er to
forskellige ting. Før var skalaen ankret til Championship = 1,0 — et falsk loft.

- **Styrke ankres nu til virkeligheden** (Premier League = 1,0). Det gør alle
  udviklings-ligaernes koefficienter ærlige (Championship falder til ~0,78 vs PL).
- **Scouting-puljen forbliver udviklingslaget** — big-5 udelades fra "Alle ligaer"
  (`benchmark: true` i registryet → `computeCrossLeaguePlayers` springer dem over),
  så PL-stjerner ikke drukner de prospekts boardet er til. Percentiler forbliver
  "bedst i det scoutbare lag".
- **Big-5 er stadig viewable** som individuelle liga-views (benchmark man kigger på).

## Log-transform (nødvendig)

Medianværdi spænder nu ~130× (Island €0,1m → PL €13m). Den lineære FLOOR+SPAN ville
have presset alle udviklings-ligaer i gulvet. `update_coefficients.py` bruger nu
`strength = FLOOR + (1-FLOOR) · (ln(median) - ln(min)) / (ln(max) - ln(min))` med
FLOOR=0,50. Resultat: PL 1,0 · Ligue 1/Bundesliga 0,88 · Serie A 0,85 · La Liga 0,83
· Championship 0,78 · … · Island 0,50. Gradienten bevaret hele vejen, ankret i PL.

## Gotcha: big-5 er indbygget i soccerdata

FBref-fetchen fejlede først for alle 5 med "No objects to concatenate". `fetch.py`
byggede `CUSTOM_LEAGUES` fra *hele* registryet og registrerede big-5 som custom —
men de er **native i soccerdata** ("ENG-Premier League" med mellemrum), og at
registrere vores nøgle "ENG-PremierLeague" som custom *skygger* den indbyggede og
knækker `read_seasons`. Fix: `fbrefBuiltin: true` på big-5 → `fetch.py` springer dem
over i custom-registreringen og passerer det native FBref-navn direkte. 4/5 virker
(551/611/507/561 spillere). **ITA-Serie A** fejler stadig — soccerdatas parser på
Serie A's sæson-side (samme "No objects"-bug som POL, ikke vores kode); den kører
Sofascore+TM only indtil FBref-siden lader sig hente (retry-senere).

## Berørte filer

```text
config/leagues.json            + 5 big-5 (benchmark:true, fbrefBuiltin:true); log-koefficienter
pipeline/fetch.py              fbrefBuiltin → brug native FBref-navn, spring custom-reg. over
pipeline/update_coefficients.py  lineær → log-transform (130× spænd, PL ankrer 1,0)
lib/league-config.ts           loadBenchmarkLeagues()
lib/players.ts                 computeCrossLeaguePlayers udelader benchmark-tier
```
