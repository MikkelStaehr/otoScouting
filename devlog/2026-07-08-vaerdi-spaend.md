# 2026-07-08 — Værdi-spænd (comp-baseret værdisætning)

Idé fra en jam-session: Transfermarkt giver ét punkt-tal, men en spillers
**statistiske + alders-ligemænd** har en værdi-fordeling. Gabet mellem hans egen
værdi og den fordeling er signalet — og *retningen* han bevæger sig i.

## Konceptet

Moneyball-comp-værdisætning. For en spiller:

- Find hans **statistiske ligemænd** — samme position, alder ±2 år, ≥900 min, med en
  markedsværdi — via percentil-vektor-similaritet (samme afstand som "Ligner
  statistisk"), top-25 nærmeste.
- Ligemændene hentes fra den **fulde pulje** (dev + big-5), så loftet kan være en
  PL-spiller — en Championship-profil kan ligne en €45m-spiller.
- Deres værdi-fordeling → **implied værdi-band** (25 / median / 75).
- **Signalet = TM-værdi vs peer-median:** under → potentiel upside; over 75-percentilen
  → markeds-præmie (hype/platform/potentiale stats ikke fanger).

Verificeret: Kabwit (SUI, €3m) → band €1,8-7-18m, upside; Dorgeles (TUR, €20m) → band
€2-5-6m, ren markeds-præmie. Signalerne varierer meningsfuldt.

## Hvorfor det er mere end økonomi

Det fortæller **retningen**. En stigende implied-værdi (peer-gruppen skifter til
dyrere spillere efterhånden som stats forbedres) *er* en trend-linje. Så det kobler
direkte på det kommende trend-lag: værdi-spændet over en sæson = et bånd der bevæger
sig, ikke bare et øjebliksbillede.

## Ærlige forbehold

Markedsværdi ≠ ren performance — der er enorme præmier for ungdom, klub-platform, hype,
kontrakt. Så det flagger "performance vs pris", ikke "sand værdi". Bandet er bredt
(medianen er overskriften). Og det er tyndt tidligt i en sæson (små samples).

## UI

En sektion på spillerkortet: en vandret bar med peer-bandet (25-75), median-linjen og
en markør for spillerens egen TM-værdi (grøn = upside, clay = præmie), plus de
nærmeste comps som klikbare chips ("ligner Said El Mala €45m") og en signal-linje.

## Berørte filer

```text
lib/similar.ts             ValueSpread-type + computeValueSpread() + wiret i getPlayerDetail
components/player-modal.tsx  Værdi-spænd-sektion + ValueSpreadBar-komponent
```
