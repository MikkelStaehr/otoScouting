# 2026-07-02 — Liga-udvidelse (16→23) + ESPN-logo-fallback

Bestillingen: udvid databasen med flere ligaer — **EU-salgsligaer** (2. divisioner,
ikke top-5-køberne) + **østeuropæisk dybde**, 10+ stk. Undervejs ramte vi en
Sofascore-blokade, som fødte en ny robusthed: et ESPN-logo-fallback.

## Kildegrundet, ikke gættet

Forkerte FBref-navne/Sofascore-ids giver tavse fejl (tomme fetches, "Invalid
league"), så hver registry-blok blev grundet i autoritative kilder:

- **Sofascore-ids**: ScraperFC's egen `sofascore.comps` (den mapping den selv
  bruger) — FRA-Ligue2=182, ESP-Segunda(La Liga 2)=54, ITA-SerieB=53,
  TUR-SuperLig=52, POR-LigaPortugal2=239, UKR=218, BUL=247.
- **FBref-navne**: `~/soccerdata/data/FBref/leagues.html` (soccerdatas cachede
  konkurrence-liste). Afslørede "(M)"-varianter: **Serie B (M)**, **Liga I (M)**.

## Hvad landede: FBref-rygraden for 6 nye ligaer

`config/leagues.json` gik fra 16 → **23 ligaer** (7 nye tilføjet). FBref-hentning
gav spillere til 6 af dem — **3.557 nye spillere** (ESP 698, ITA 638, TUR 600, BUL
548, FRA 544, UKR 529). Total nu ~9.900 spillere over 20 ligaer.

Tre forudsete fælder ramte præcist som ventet:

1. **To-kørsler-registreringen** — FRA fejlede pass 1 med "Invalid league" (soccerdata
   læser `league_dict.json` ved import-tid), virkede pass 2. `ingest.py`'s retry-passes
   håndterer det automatisk.
2. **Serie B (M)** — "Serie B" gav "No objects to concatenate"; det rigtige FBref-navn
   er "Serie B (M)". Rettet i registryet → 638 spillere.
3. **POR-LigaPortugal2 er ikke på FBref** (som ISL) → Sofascore-only.

## Sofascore-blokaden (og hvorfor resten venter)

Efter den store 64-min ingest + mange hurtige id-opslag ramte vi et **Cloudflare-block
på `api.sofascore.com`** — både søge-endpointet (`/search/all` → 403 challenge) OG
data-endpoints (`KeyError: 'seasons'` = challenge-svar uden data). Hovedsiden
(`sofascore.com`) svarede stadig 200; kun API-subdomænet flaggede os. En 25-min
afkøling hjalp ikke — sådanne IP-blokke varer typisk timer, og hvert nyt forsøg kan
forlænge dem. Samtidig var **clubelo.com nede** (timeout), så styrke-koefficienterne
kører videre på placeholders.

Derfor venter stadig: **Sofascore-laget** (xG/xA/pass% + hold + heatmaps +
formationer) for alle 7 nye ligaer, og **6 ligaer der endnu mangler Sofascore-ids**
(GRE, SRB, HUN, ROU, SVK, SVN — SVK/SVN er Sofascore-only). Det er sat op som et
auto-retry der prøver igen når blokken letter.

## ESPN-logo-fallback (robustheden det affødte)

Logoer var **dobbelt afhængige af Sofascore**: `fetch_logos.py` læser
`sofascore_teams` (tomt for de nye ligaer) OG henter billederne fra det blokerede
`api.sofascore.com/team/{id}/image`. Så de nye ligaer ville stå uden skjolde indtil
Sofascore letter — skidt, især med artikel-vinklen for øje.

Løsningen: **ESPNs åbne API** er uafhængig og Cloudflare-fri.
`pipeline/fetch_logos_espn.py` henter crests pr. liga (`site.api.espn.com`), gemmer
selv-hostet til `public/logos/espn/{id}.png`, og matcher FBref-holdnavne → ESPN-id
(genbruger `norm` + `best_match` fra `fetch_logos.py`). `lib/team-logos.ts` prøver nu
**Sofascore først, ESPN som fallback** — så ESPN overskriver aldrig et Sofascore-crest,
men fanger huller. Det er et permanent sikkerhedsnet, ikke smid-væk-arbejde.

- **Dækning uden Sofascore: 68/78 hold** (ITA 20/20, TUR 18/18, ESP 16/22, FRA 14/18).
- **`norm`-fix**: tyrkisk "ı" (dotless i) blev slettet af `[^a-z]`-reglen → Kasımpaşa
  matchede ikke. Tilføjede `ı→i` i **begge** norm-funktioner (JS + Python holdt i sync).
- **ESPN-huller** (10 hold: Amiens, Bastia, Le Mans, Troyes; Deportivo, Zaragoza,
  Málaga, Huesca, Racing Santander, Cultural Leonesa): ægte roster-forskelle — ESPN
  lister dem ikke. De får crests fra Sofascore når blokken letter (→ ~100%).
- UKR/BUL/POR-Liga 2 er slet ikke på ESPN → helt afhængige af Sofascore-crests.

## Status

- ✅ Registry 16→23; FBref-rygrad for 6 nye ligaer; ESPN-logoer for de 4 ESPN-dækkede.
- ⏳ Venter på Sofascore-blokken: xG/hold/spatial for de 7, + de 6 sidste ligaers ids,
  + clubelo-koefficienter. Auto-retry sat op.
- DB-commit (Git LFS) venter til udvidelsen er **komplet**, så vi ikke committer en
  halvfyldt DB. Se [[2026-07-02-polish-datamodel]] for datamodellen udvidelsen bygger på.

## Berørte filer

```text
config/leagues.json            +7 ligaer (FRA/ESP/ITA/TUR/UKR/BUL Sofascore-ids + POR2); Serie B (M)
pipeline/fetch_logos_espn.py   NY — ESPN-crest-henter + FBref-navnematch (uafhængig af Sofascore)
config/team-logos-espn.json    NY — normaliseret holdnavn → ESPN-id (fallback-map)
public/logos/espn/*.png        77 selv-hostede ESPN-crests
lib/team-logos.ts              ESPN-fallback i teamLogoUrl(); norm ı→i
pipeline/fetch_logos.py        norm ı→i (holdt i sync med JS)
.gitignore                     + pipeline/downloaded_files|output|.cache (botasaurus-junk)
```
