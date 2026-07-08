# 2026-07-03 — Ligastyrke fra Transfermarkt (farvel clubelo)

Cross-league-boardet ("Alle ligaer" / udviklingslaget) rangerer på tværs af 29 ligaer
og diskonterer hver ligas output med en styrke-koefficient. Kilden til den koefficient
skiftede fra **clubelo-Elo** til **Transfermarkt-medianværdi**.

## Hvorfor skifte

To problemer med clubelo, begge levet i praksis:

1. **Nede = intet.** clubelo (`api.clubelo.com`) har været utilgængelig fra os i dagevis
   — DNS resolver serveren (37.128.134.74), men den svarer ikke på forbindelser (timeout,
   0 bytes), på tværs af både hjemme-wifi og mobilt hotspot. Alt andet svarer øjeblikkeligt,
   så det er clubelos server, ikke os. Da vi tilføjede de 13 nye ligaer var den også nede →
   de fik arbitrære placeholder-koefficienter.
2. **Ufuldstændig.** clubelo har ikke Elo for de mindste ligaer (Finland, Island fik
   `avgElo=None` selv da serveren virkede).

Transfermarkt løser begge: **markedsværdi dækker alle 29 ligaer**, ingen ekstern server
der kan gå ned, og **median trup-værdi måler spiller-kvalitet direkte** — præcis det en
cross-league percentil-sammenligning har brug for. På de 14 ligaer hvor vi havde ægte
clubelo korrelerer de to **r≈0,84**, så det er en tro, selv-indeholdt erstatning.

## Vigtig indsigt: kilden betyder næsten ingenting

Undervejs blev det klart at *hvilken* kilde (clubelo vs værdi vs placeholder) næsten ikke
rykker rangeringen: koefficienterne lander alle i et mildt spænd, og hele justeringen er en
~10-15% nudge, ikke en omvæltning. Det der betyder noget er (a) at vi justerer *overhovedet*
(så rå stat-padding i svage ligaer ikke topper), og (b) *hvor stejl* diskonteringen er — et
produkt-valg, uafhængigt af datakilden. Så clubelo-nedbruddet var reelt lav-indsats; vi
valgte ren TM for at være uafhængige.

## Metoden

`pipeline/update_coefficients.py` omskrevet: læser `transfermarkt_players`, tager median
markedsværdi pr. liga (robust mod enkelte superstjerner), og mapper til
`strength = FLOOR + SPAN * (median / stærkeste)` med FLOOR=0.80, SPAN=0.20 → spænd 0,81–1,0.
Skalaen er **mild** (matcher den oprindelige filosofi); FLOOR/SPAN er tunbare hvis vi vil
have stejlere adskillelse. Resultat: ENG-Championship 1,0 → Island 0,813, ordnet fornuftigt
(TUR-Süper Lig nu korrekt 0,907, ikke undervurderet).

Registryet: `strength` + `medianValue` pr. liga, `avgElo` fjernet, `eloSource` →
`strengthSource` (provider: transfermarkt). clubelo/clubeloLevel-felterne bliver som legacy
(uskadelige, ikke længere læst).

## Berørte filer

```text
pipeline/update_coefficients.py   omskrevet: styrke fra TM-medianværdi (ikke clubelo)
config/leagues.json               strength+medianValue for alle 29; strengthSource-proveniens
```
