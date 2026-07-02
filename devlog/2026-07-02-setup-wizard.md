# 2026-07-02 — Setup-wizard: fra frisk clone til data

Formålet: en helt klar vej frem når appen installeres på en ny maskine. `git clone`
→ `npm install` → åbn app → en wizard tager over og henter data. Ingen manuelle
pipeline-kommandoer at huske.

## Realiteten: Node vs. Python

`npm install` dækker kun Node-siden. Data-pipelinen er Python (soccerdata + ScraperFC
+ botasaurus). Så wizarden kan ikke være rent “ét klik i browseren” uden at røre
Python. Løsningen: wizarden **detekterer og installerer** Python-miljøet, og gør det
til et projekt-lokalt `.venv` så en frisk clone bliver selvstændig.

## Wizarden (vises når databasen er tom)

1. **Forudsætninger** — prober Python (`/api/setup/check`) + om pipeline-pakkerne kan
   importeres. Manglende → **ét klik** opretter `.venv` og pip-installerer
   (`/api/setup/install`, streamet). Python helt fraværende → guide + “tjek igen”.
2. **Vælg ligaer** — hele registryet, grupperet i Nordisk dybde / Europæiske
   salgsligaer, med flag + “vælg alle”.
3. **Hent data** — kerne-stats først (Sofascore + FBref → appen brugbar), derefter
   heatmaps + formationer i baggrunden (`/api/setup/ingest`, phase core|spatial).
   Spatial-processen er guardet så den overlever at man åbner appen midtvejs.

## Portabilitet (den skjulte gevinst)

- **`lib/python.ts`** `resolvePython()` er nu ét sted der finder interpreteren:
  projekt-`.venv` → `OTOSCOUT_PYTHON` → gammel `sbspike`-sti → system `py`/`python3`.
  Den **hardcodede venv-sti** i `/api/refresh` er væk — refresh virker nu på en
  fremmed maskine.
- **`ingest.py --leagues a,b,c`** — hent et udvalg (per-liga Sofascore for subsets).
- **botasaurus tilføjet til `requirements.txt`** — heatmaps/formationer krævede den,
  men den var aldrig listet, så en frisk install ville have fejlet på spatial-laget.

## Berørte filer

```text
components/setup-wizard.tsx     NY — 3-trins wizard (prereq → ligaer → hent)
lib/python.ts                   NY — fælles Python-resolver
app/api/setup/check/route.ts    NY — prober Python/deps/data + liga-registry
app/api/setup/install/route.ts  NY — opret .venv + pip install (streamet)
app/api/setup/ingest/route.ts   NY — kør ingest core|spatial for valgte ligaer
app/api/refresh/route.ts        bruger resolvePython (ingen hardcoded sti)
pipeline/ingest.py              + --leagues subset
pipeline/requirements.txt       + botasaurus
app/layout.tsx                  mounter <SetupWizard/>
```
