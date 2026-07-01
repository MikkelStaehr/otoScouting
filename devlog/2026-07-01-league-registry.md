# 2026-07-01 — Liga-registry: ét sted at tilføje ligaer

## Hvorfor

Vi skal skalere fra 3 til ~18 ligaer (nordisk dybde + europæiske salgsligaer).
Før var "tilføj en liga" spredt over fem steder: Sofascore-id i én pipeline,
FBref-navn + sæson-måneder i en anden, ligastyrke i en tredje, logoer i en fjerde.
Uholdbart ved 18 ligaer. Så: byg fundamentet før bulk-tilføjelsen.

## Hvad blev lavet

**Ét centralt registry** — `config/leagues.json` er nu den eneste kilde til
sandhed. Hver liga har alt sin metadata ét sted:

```json
"NED-Eredivisie": {
  "sofascore": 37, "sofascoreSeason": "25/26",
  "fbref": "Eredivisie", "fbrefSeason": "2025-2026",
  "seasonStart": "Aug", "seasonEnd": "May",
  "clubelo": "NED", "espn": "ned.1",
  "strength": 1.0, "avgElo": 1500.0
}
```

- **`pipeline/registry.py`** — delt loader begge pipelines bruger.
- **`fetch_sofascore.py`** og **`fetch.py`** læser nu registryet i stedet for
  hardcodede dicts. FBref-sæson defaulter til registryets `fbrefSeason`.
- **`lib/league-config.ts`** læser `strength` fra den nye struktur.
- **`pipeline/update_coefficients.py`** — NYT script der henter clubelo-Elo,
  beregner ligastyrke-koefficienten pr. liga (via `clubelo`-landekode +
  `clubeloLevel`), normaliserer til stærkeste = 1.0, og skriver `strength` +
  `avgElo` tilbage i registryet. Så er koefficienterne automatiske.

## Nu er "tilføj en liga"

1. Tilføj én blok i `config/leagues.json` (id'er + navne + sæson).
2. `python pipeline/update_coefficients.py` (fylder strength/avgElo).
3. Fetch (Sofascore hurtig, FBref langsom).
4. (Logoer — stadig manuelt indtil videre; automatiseres i bulk-tilføjelsen.)

## Detalje: Elo på tværs af niveauer

clubelo sammenligner på tværs af lande OG divisioner. En stærk andendivision
(fx Championship) kan derfor rangere over en svag topdivision — hvilket er
korrekt for spiller-kvalitet. Andendivisioner sætter `"clubeloLevel": 2`
(default 1) så scriptet henter det rigtige niveau-gennemsnit.

## Verifikation

- `update_coefficients.py` reproducerede de eksisterende koefficienter præcist
  (DEN 1.0 / NOR 0.961 / SWE 0.916).
- Begge pipelines loader registryet; CUSTOM_LEAGUES bygges korrekt.
- `tsc` rent; cross-league renderer stadig (verificeret på temp-port 3001).
- Ingen re-fetch nødvendig — kun konfig-struktur ændret.

## Berørte filer

```text
config/leagues.json          omstruktureret til fuldt registry
pipeline/registry.py         NY — delt loader
pipeline/update_coefficients.py  NY — clubelo → strength
pipeline/fetch.py            læser registry; sæson defaulter derfra
pipeline/fetch_sofascore.py  læser registry
lib/league-config.ts         strength fra ny struktur
```
