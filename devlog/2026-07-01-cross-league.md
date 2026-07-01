# 2026-07-01 — Cross-league sammenligning med ligastyrke-justering

## Hvad blev bestilt

Efter at spillere kom ind i alle 3 ligaer: kunne vi sammenligne spillere **på
tværs** af ligaerne — den rigtige prospekt-jagt. Valget faldt på den korrekte
version med **ligastyrke-justering** (ikke bare én naiv fælles pulje, som ville
få en Allsvenskan-topscorer til at se bedre ud end en Superliga-spiller).

## Beslutningen der bar featuren: hvor kommer koefficienten fra?

En ligastyrke-koefficient må ikke være et tal man finder på. Jeg grundede den i
**clubelo.com** — gratis, objektiv Elo-rating pr. klub. Gennemsnitlig klub-Elo pr.
liga (øverste division), normaliseret så den stærkeste = 1.0:

| Liga | Ø klub-Elo | Koefficient |
|------|-----------|-------------|
| Superliga | 1493 | 1.000 |
| Eliteserien | 1434 | 0.961 |
| Allsvenskan | 1367 | 0.916 |

Tallene ligger i `config/leagues.json` med fuld proveniens (kilde, dato, metode) og
er **tunbare** — spændet er mildt (0.92–1.0), hvilket faktisk er realistisk mellem
netop disse nordiske ligaer, men kan gøres stejlere hvis man er uenig.

## Hvordan justeringen virker (det principielle)

- Koefficienten **diskonterer output** før percentil-puljen: en svagere ligas
  tælle-stats ganges med dens koefficient, så det bliver sværere at toppe en
  fælles rangering.
- **Kun rangeringen** påvirkes. De viste per-90-tal er altid rå — en spiller ser
  sine egne rigtige tal, men percentilen (og dermed OUT) er ligastyrke-justeret.
- **Rates skaleres ikke** (pass%, save%, konvertering, g−xG, goals prevented) —
  en koefficient ville ødelægge enheden (85% pass × 0.9 = nonsens).
- **Enkelt-liga-visninger er uændrede** — koefficienten er 1 som default.

Implementeret som en valgfri `strengthOf(player)`-parameter til `enrichPlayers()`:
`rankValue` = `valueOf` × koefficient (for non-rates), brugt til pulje + percentil;
`valueOf` (rå) bruges stadig til visning. Single-league kalder uden parameteren.

## Datavej

Ny `getCrossLeaguePlayers()`: løber alle ligaers aktuelle sæson, genbruger den
udtrukne `prepareRows()` (rå + Sofascore-xG-merge + Δ), samler ALLE spillere i én
pulje, og enricher med `strengthOf = coef[league]`. Keepere pooles på tværs for
sig, markspillere for sig (som før, bare på tværs af ligaer nu).

## Frontend

- **⚑ Alle ligaer**-knap i vælgeren (`/?league=ALL`). Åbner på Spillere-fanen.
- **Liga-badge** (DEN/SWE/NOR) pr. række i cross-league mode.
- Alle eksisterende filtre virker på tværs → prospekt-jagt = `alder ≤ 21` +
  `min. minutter`, sortér på OUT.
- **Hold** forbliver per-liga; på "Alle ligaer" viser Hold-fanen en note om at
  vælge en enkelt liga (holdpercentiler giver kun mening inden for én liga).

## Verifikation

- `npx tsc --noEmit` rent, alle sider (inkl. `?league=ALL`) svarer 200.
- Top-15 på tværs er en sund blanding: `SWE SWE SWE DEN NOR DEN SWE SWE NOR DEN
  DEN NOR NOR SWE DEN` — den milde justering udrydder ikke svagere ligaer, men
  diskonterer dem let. Som forventet.
- Bemærkning: toppen er en anelse Allsvenskan-tung, fordi OUT vægter mål/assists/
  skud (ikke xG), så Allsvenskan straffes ikke for manglende xG. Tunbart via
  koefficienten hvis ønsket.

## Berørte filer

```text
config/leagues.json      NY — Elo-koefficienter + proveniens
lib/league-config.ts     NY — loadLeagueStrength()
lib/model.ts             strengthOf-param; rankValue skalerer non-rates i pulje+percentil
lib/players.ts           prepareRows() udtrukket; getCrossLeaguePlayers() tilføjet
app/page.tsx             league=ALL → cross-league board + footer-note
components/board-switch.tsx  ⚑ Alle ligaer-knap, header, Hold-note
components/player-table.tsx  crossLeague-prop + liga-badge
```
