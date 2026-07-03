# 2026-07-03 — Værdi-laget (Fase 1): Transfermarkt-markedsværdi

Starten på "value-per-output"-filosofiens fuldendelse: fra "hvem er god" til "hvem er
god *og* billig". Fase 1 er dataen — markedsværdi for alle 29 ligaer.

## Værdi, ikke løn — og hvorfor

Vigtig skelnen: **markedsværdi** (transferpris, Transfermarkt) ≠ **løn** (gage, Capology).
Jeg tjekkede dækningen mod vores 29 ligaer:

- **Transfermarkt** dækker ~alle vores ligaer.
- **Capology** har løndata for kun ~10 — og **nul** for de nordiske/østeuropæiske
  producent-ligaer vi scouter mest i.

Så vi **leder med markedsværdi**: den dækker bredt, og for en salgsliga-scout er det
faktisk det mere relevante tal (hvad koster det at *signe* et prospekt). Løn kan lægges
på senere som bonus for de ~10 vestlige ligaer. Markedsværdi giver desuden *værdi-historik*
pr. spiller → binder ind i trend-laget.

## Let scrape, ikke tung (IP-læren fra Sofascore)

ScraperFC's `scrape_players` henter **ét kald pr. spiller** (~1000+/liga × 29 ≈ 30.000
requests) — præcis den slags burst der flaggede vores IP hos Sofascore. I stedet henter
`fetch_transfermarkt.py` **klub-trup-siderne** (`/kader/verein/{id}/saison_id/{sid}/plus/1`),
som viser alle spilleres markedsværdi i én tabel: ~18-20 requests/liga, ~580 i alt, pacet.
**cloudscraper** klarer Transfermarkts Cloudflare — ingen browser, ingen hæng, og
Sofascore-IP-flaget er ligegyldigt (andet domæne).

## TM-koder verificeret, ikke gættet

TM-konkurrencekoder er lumske (Østrig=A1, Schweiz=C1, Kroatien=KR1, Tjekkiet=TS1,
Serbien=SER1, Ungarn=UNG1). ScraperFC kendte 10 af vores; de øvrige 19 blev **verificeret**
ved at hente hver TM-side og læse liga-navnet, før de røg i registryet.

## Gotcha: kalenderår-ligaernes saison_id

TM's saison_id er ikke det man tror for kalenderår-ligaer: sæson-nøgle `2026` mapper til
saison_id **`2025`** (start-år-konvention). Første kørsel gav derfor 0 spillere for NOR/SWE/
FIN/ISL. Fix: slå saison_id op autoritativt via `get_valid_seasons(league)[key]` i stedet
for at aflede den.

## Resultat

**29/29 ligaer · 16.563 Transfermarkt-spillere · 14.625 med markedsværdi.** Værdier
sanity-tjekket (Ligue 2-prospekts €10-23m i nedrykkede klubber, snit ~€1m — plausibelt).

## Næste faser

- **Fase 2** — matcher: TM-spiller → vores spiller (navn+hold+liga fuzzy, som FBref↔Sofascore).
- **Fase 3** — model: `value` på berigede spillere + `OUT ÷ værdi` = value-per-output.
- **Fase 4** — UI: undervurderede-prospekts-liste, værdi-kolonne, værdi + historik på kortet.

## Berørte filer

```text
config/leagues.json            + transfermarkt-kode på alle 29 ligaer (verificeret)
pipeline/schema_transfermarkt.sql  NY — transfermarkt_players (værdi + TM-id + bio)
pipeline/fetch_transfermarkt.py    NY — let klub-side-scrape via cloudscraper
pipeline/ingest.py             + trin 2b (Transfermarkt); --tm-only / --no-tm
```
