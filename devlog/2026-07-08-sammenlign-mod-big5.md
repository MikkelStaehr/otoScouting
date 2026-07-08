# 2026-07-08 — FBref-huller lukket + "Ligner i big-5"

To ting oven på [[2026-07-08-big5-benchmark-tier]]: de sidste FBref-huller blev
lukket, og benchmark-tieret blev gjort *brugbart* — man kan nu sammenligne en
udviklings-profil mod big-5.

## FBref-hullerne (POL, Grækenland, Serie A)

Tre ligaer manglede FBref-rygraden. To forskellige soccerdata-problemer:

- **POL + Grækenland:** `read_player_season_stats` dropper ubetinget "Matches"- og
  "Rk"-kolonnegrupperne, men mindre ligaers FBref-tabeller har dem ikke → KeyError,
  0 spillere. Fix: monkeypatch `pd.DataFrame.drop` i `fetch.py` så et drop af en
  manglende label bliver en no-op (kun når det ellers ville rejse).
- **Serie A:** soccerdatas indbyggede FBref-navn "Serie A" er nu tvetydigt — FBref
  disambiguerer mænd med "(M)" (Serie A / (F) / (M) / (W)), præcis som Serie B.
  Registreret ITA-SerieA som custom liga med `fbref: "Serie A (M)"` i stedet for
  den indbyggede. (De 4 andre big-5 er stadig indbyggede — kun Serie A kolliderer.)

Alle 30 ligaer har nu FBref (POL 553, Grækenland 466, Serie A 609). Samtidig blev
de 4 FBref-løse ligaer (Island, Liga Portugal 2, Slovakiet, Slovenien) droppet —
uden FBref intet spillerboard, så ingen scouting-værdi.

## "Ligner i big-5" (sammenlign mod benchmark)

Benchmark-tieret var *synligt* (individuelle liga-views) men ikke *sammenligneligt*.
Nu: en additiv sektion på spillerkortet der viser de nærmeste big-5-profiler.

Nøglen er percentil-basen. Scouting-boardet bruger dev-only-puljen (rene percentiler);
men for at sammenligne en dev-spiller *mod* en big-5-spiller skal begge ligge i **én**
pulje. Så `getFullPoolPlayers()` (som cross-league, men inkl. benchmark) giver den
fælles base. `getPlayerDetail`:

- dev-spiller: kort + dev-lookalikes på board-basen (uændret); **`benchmarkSimilar`**
  beregnes mod big-5 i den fulde pulje.
- big-5-spiller (åbnet fra eget liga-view): faldt før til null (ikke i dev-puljen) —
  nu findes target i den fulde pulje, så deres kort virker igen.

Verificeret: Victor Torp (Championship) → Dani Olmo / Pépé; Darío Osorio (Superliga)
→ Xavi Simons / Fabio Vieira. Meningsfulde "spiller som"-matches.

## Berørte filer

```text
pipeline/fetch.py              _safe_drop monkeypatch (manglende Matches/Rk); Serie A (M) custom
config/leagues.json            ITA fbref 'Serie A (M)'; 4 FBref-løse ligaer droppet
lib/players.ts                 getFullPoolPlayers() (pulje inkl. benchmark)
lib/similar.ts                 similarTo() helper; benchmarkSimilar; big-5-target fallback
components/player-modal.tsx     "Ligner i big-5"-sektion
```
