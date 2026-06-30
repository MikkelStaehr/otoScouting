# 2026-06-30 — Spillere i alle ligaer, kun aktuel sæson, dynamisk overskrift

## Hvad blev bestilt

Tre ting, efter at Hold-viewet var blevet multi-liga:

1. **Spillere i flere ligaer** — vi skal kunne sammenligne spillere og finde
   prospekts på tværs af Superliga + Allsvenskan + Eliteserien.
2. **Kun aktuel sæson** — sæson-vælgeren med 2025/2026 var forvirrende. Vi vil
   kun se den aktuelle sæson lige nu.
3. **Dynamisk overskrift** — headeren stod altid "DEN · Superliga", også når man
   kiggede på en norsk liga.

## Hvad blev lavet

### 1 + 2: Kun aktuel sæson

- `pipeline/fetch_sofascore.py`: de nordiske ligaer henter nu kun `["2026"]`
  (ikke længere `["2025", "2026"]`). Superliga er stadig `["25/26"]`.
- Slettede de 902 spiller- + 37 hold-rækker fra sæson 2025 i databasen.
- Sæson-vælgeren i `board-switch.tsx` skjuler sig automatisk, når en liga kun har
  én sæson (`seasonsForSelected.length > 1`-betingelsen), så der var ingen UI at
  fjerne — den forsvandt af sig selv.
- **Vigtigt:** gammel data slettes ikke i fremtiden. Tabellerne droppes aldrig,
  og en refresh erstatter kun den (liga, sæson) den henter. Når 2026 er færdig og
  2027 starter, bliver 2026 liggende automatisk. Vi pre-loader bare ikke gammelt nu.

### 3: Dynamisk overskrift

- Flyttede titel-blokken fra `app/page.tsx` (server, hardkodet) ind i
  `board-switch.tsx` (client). Headeren læser nu den valgte liga/sæson og skifter
  tæller-enhed mellem "hold" og "spillere" efter fanen.
- Norsk liga → **NOR · Eliteserien**, svensk → **SWE · Allsvenskan**.

### Det store: spillere i alle 3 ligaer

Spiller-boardet er FBref-baseret (alder/position/nationalitet kommer fra FBref —
Sofascore giver dem ikke billigt). Så det krævede FBref-data for de nye ligaer.

- Registrerede `SWE-Allsvenskan` (FBref "Allsvenskan") og `NOR-Eliteserien` (FBref
  "Eliteserien") som custom leagues i soccerdata. Begge er kalenderår-ligaer
  (forår–efterår) → sæsonkode = året (`2026`).
- Hentede begge: **355 + 357 spillere** med alder, position og nationalitet.
- **Forenede liga-vælgeren**: før styrede den kun Hold. Nu styrer den BÅDE Spillere
  og Hold, fordi FBref og Sofascore deler sæsonkoder (Superliga `2526`, nordiske
  `2026`). Vælg en liga → begge boards skifter. Se [ARKITEKTUR.md](ARKITEKTUR.md#frontend).
- xG matcher fint på tværs af kilderne: 341/357 (95%) for Eliteserien.

## Tre fejl fanget undervejs

1. **`schema.sql` havde `DROP TABLE IF EXISTS players`** — at hente en ny liga
   ville have slettet hele spiller-tabellen og dermed Superligaen. Gjort no-drop
   (`CREATE TABLE IF NOT EXISTS`) + per-(liga, sæson) `DELETE`+`INSERT`, præcis som
   Sofascore-tabellerne allerede gjorde.

2. **FBref-alder kom som `"20-178"`** (år-dage) for igangværende sæsoner. Den gamle
   `ints()`-konvertering lavede det om til 0 (alle nordiske spillere fik alder 0).
   Tilføjede en `ages()`-parser (tag delen før "-") + et fallback der udleder alder
   af fødselsår (`sæson-slut-år − born`).

3. **Refresh-knappen tvang `--season 25/26` på ALLE ligaer** — det ville have
   knækket de nordiske (de er sæson 2026, ikke 25/26), og den hentede kun Superliga
   FBref. Refresh-ruten kører nu Sofascore for alle ligaer og FBref for alle tre.

## Oprydning

- **Logoer** for alle 16 svenske + 16 norske klubber (ESPN-ids). Fordi FBref og
  Sofascore staver hold forskelligt (`molde` vs `molde fk`, `aik stockholm` vs
  `aik`), har logo-mappet begge normaliserede nøgler → samme id. Verificeret: 0
  manglende crests på tværs af begge kilder.
- **Console-crash** på Windows cp1252 ved nordiske tegn (`č`, `ø`) i sanity-print
  fikset med `sys.stdout.reconfigure(encoding="utf-8")`.
- Refresh-modal tekst opdateret: Sofascore ~30 sek (3 ligaer), FBref ~10 min.

## Verifikation

- `npx tsc --noEmit` rent.
- Alle tre liga-sider svarer 200.
- Aldre: Superliga 16–41, Eliteserien 15–38, Allsvenskan 16–39 (4 Superliga-spillere
  uden fødselsdata viser "—", hvilket er ærligt).

## Berørte filer

```text
pipeline/fetch.py            no-drop + ages() + DELETE per liga-sæson + utf-8 stdout + nye custom leagues
pipeline/fetch_sofascore.py  nordiske ligaer → kun "2026"
pipeline/schema.sql          DROP TABLE → CREATE TABLE IF NOT EXISTS
app/page.tsx                 én vælger driver både players + teams; fjernet hardkodet header
components/board-switch.tsx  dynamisk header; vælger gælder begge faner
components/settings-modal.tsx opdaterede tidsestimater
app/api/refresh/route.ts     multi-liga refresh (alle ligaer, alle 3 FBref-steps)
lib/team-logos.ts            +32 nordiske klubber, begge stavevarianter
```
