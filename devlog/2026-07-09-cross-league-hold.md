# 2026-07-09 — Table of Justice for hold (cross-league)

"Alle ligaer" virkede kun for spillere — Hold-fanen tvang dig over på spiller-visningen
(hold-percentiler var per-liga). Nu er der en ægte **cross-league hold-rangering**,
analog til spiller-boardet.

## `getCrossLeagueTeams()` (lib/teams.ts)

Alle scouting-ligaers hold i én pulje, hver metric strength-justeret og re-percentileret
på tværs — med en **composite score** (0-100). Strength-justeringen straffer svage ligaer
i den *rigtige* retning (bedre end keeper-modellens ujævne håndtering):

- mere-er-bedre × ligaens strength-koefficient
- mindre-er-bedre (invers: mål imod, skud imod) **÷** koefficienten (så en svag ligas
  lave tal bliver *dårligere*, ikke bedre)
- rates (bold%, pass%) urørt — som i spiller-modellen

Score = balanceret gennemsnit af offensive + defensive percentiler. Benchmark (big-5)
ekskluderet, ligesom spiller-boardet. Cachet på DB-mtime.

## Resultat

Top: Benfica, Fenerbahçe, Sporting, Union SG, Club Brugge — de stærkeste klubber fra de
stærkeste scouting-ligaer, ikke bare hvem der dominerer sin egen svage liga.

## Wiring

- `app/board/page.tsx`: `crossLeague ? getCrossLeagueTeams() : getTeams(...)`.
- `components/board-switch.tsx`: fjernet tvangen til Spillere + placeholderen; scope
  er nu brugerens valg og persisterer (begge boards virker cross-league).
- `components/team-table.tsx`: `crossLeague`-prop → **Score**-kolonne (accent, default-
  sort), liga-tag ved holdnavnet, celle-heat på cross-league-percentiler. Enkelt-liga
  beholder rating-sort.
- `lib/types.ts`: `EnrichedTeam.score?` (kun sat af getCrossLeagueTeams).

Testet: /board?league=ALL → 200, Hold-fane med Score-kolonne, fornuftig rangering. tsc rent.
