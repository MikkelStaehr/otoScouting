# 2026-07-02 — Rolle-motoren: datadrevne spiller-roller

Det mest spændende spor: roller à la Football Manager, men **deskriptivt** i stedet
for præskriptivt. FM tildeler roller ud fra attributter ("passer til rollen"); vi
tildeler den rolle spilleren **faktisk spillede** — ud fra HVOR han placerer sig
(heatmap-centroider + angreb/forsvar-skiftet) og HVAD han laver der (ligastyrke-
justerede percentiler). Rollen er et fuzzy best-fit med sikkerhed, ikke en facit.

## Klassificøren

`lib/roles.ts` `classifyRole(posGroup, percentiler, centroid)` → `{bucket, primary,
secondary}`, hver `{role, conf 0-100, why}`. ~28 roller i 6 buckets (GK/CB/BACK/
MID/WIDE/STRIKER). Hver rolle = en vægtet sum af **navngivne termer** (percentil-
metrikker + positions-signaler: fs=frem-skift, inward, wide, deep, advanced, range,
gkAdv, drop). Kræver en heatmap-centroide — `getAllCentroids()` (cached, alle
spillere). ~3900/4100 spillere får en rolle.

**Verificeret:** Otamendi=Ball-Playing CB, Berg=Deep-Lying Playmaker, Touré=Poacher,
Džeko=Complete Forward, Şimşir=Wide Playmaker.

## "Hvorfor" — begrundelse

Term-strukturen gav forklaringen gratis: hver rolle-tildeling viser de **top-signaler
spilleren faktisk er stærk på** ("Afleveringspræcision 97p · Afleveringer 98p · dyb
position"). Inverse termer læses som "lav Afleveringer (2p)" — fx en poachers lave
involvering, der netop definerer rollen. Gør rollen transparent og verificerbar.

## Fra hård bucket til kandidat-buckets

Første version **låste** hver spiller til én bucket (posGroup + hård sidelæns-tærskel)
og scorede kun roller indenfor. Det misroutede spillere hvis centroide er tvetydig
men hvis stats er klare: en roamende kant (Suso) fik en central MID-rolle; en bred-
driftende boldspillende CB (Chukwudi) fik Attacking Wing-Back.

**Fix:** score på tværs af **kandidat-buckets** (DF→CB+BACK, MF→MID+WIDE, FW→STRIKER
+WIDE) og lad statistikken bryde uafgjort — positionering er et signal i scoren, ikke
en port. For at stoppe roller uden stil-signal i at "stjæle" på tværs fik de lækkende
de rigtige signaler (Wide Playmaker kræver indlæg; Advanced Playmaker et centralitets-
signal; backs et wide-signal). Resultat: Suso→Winger, Chukwudi→Ball-Playing/Aggressive
CB, sund fordeling. Fuzzy og finpudses løbende — det bliver bedre med mere data.

## Overflader

- **Spillerkort**: primær + sekundær rolle-badge med sikkerhed, hover-forklaring på
  rolle-betydningen (`ROLE_DESC`) + "hvorfor"-linjen.
- **Shortlist**: rolle-dropdown grupperet efter kæde (matcher primær ELLER sekundær)
  + rolle-beskrivelse + Rolle-kolonne. "Find alle Ball-Playing CBs på tværs af ligaer"
  virker (Mauro Júnior 96%, …).
- **Raw DB**: Rolle-kolonne (sorterbar, i CSV).
- **Hold**: rolle på opstillings-prikkerne (hover) + Rolle-kolonne i Trup-tabellen —
  se en klubs rolle-sammensætning på ét blik.

## Berørte filer

```text
lib/roles.ts        NY — term-baseret klassificør + why + kandidat-buckets
lib/role-meta.ts    NY — ROLE_DESC (forklaringer) + ROLE_GROUPS (filter-taxonomi)
lib/heatmap.ts      getAllCentroids (cached, alle spillere)
lib/similar.ts / shortlist.ts / raw-data.ts / team-report.ts  rolle i payloads
components/player-modal.tsx / shortlist-view.tsx / team-modal.tsx / formation-pitch.tsx  overflader
```
