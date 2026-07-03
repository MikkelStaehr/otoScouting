# 2026-07-03 — Udvidelsen komplet: frisk IP + hæng-resiliente orchestratorer

Opfølgning på [[2026-07-02-liga-udvidelse-og-espn-logoer]], hvor Sofascore-laget
hang på en Cloudflare-blok. I dag blev de sidste 13 nye ligaer hentet helt færdig.
Registryet er nu på **29 ligaer**.

## Cloudflare-blokken: det var IP'en

Efter grundig diagnose (HTML-siden loadede fint = 1,5 MB; kun `api.sofascore.com`
gav challenge; botasaurus kunne loade siden men ikke løse API-challengen) stod det
klart: **vores IP var flagget**, så Cloudflare serverede en *sværere* challenge som
headless-botasaurus ikke kunne løse. Et helt døgns venten løftede den ikke (nattens
timevis-retries holdt den sandsynligvis varm).

**Fix: skift til en frisk IP.** Ingen VPN/proxy installeret, og kommercielle
datacenter-IP'er er ofte *mere* flaggede af Cloudflare — så løsningen blev et **mobilt
hotspot** (residential-agtig cellulær IP). Fælder undervejs: Mac'en hang på hjemme-wifi
(statisk-IP-config forhindrede skift), og telefonen delte sit *wifi* i stedet for
mobildata (samme hjemme-IP ud). Da telefonen var på ren mobildata → frisk IP → Sofascore
virkede øjeblikkeligt.

**Lære (vigtig):** IP'en blev kun flagget af mine mange hurtige id-opslag i træk. Den
*pacede* ingest flaggede den aldrig. Så fremover: kør Sofascore pacet fra hjemme-nettet
(passer 14-dages-snapshot-kadencen) — ingen rotation/proxy nødvendig; flagget decayer selv.

## Botasaurus hænger på cellular → retry-orchestratorer

På cellular (høj latency) hang botasaurus' browser langt oftere end hjemme (~2/3 mod
~1/16). Da `fetch_sofascore` kører alle ligaer i én proces uden timeout, ville ét hæng
vælte batchen. Løsning: **per-liga orchestratorer med proces-gruppe-timeout** — kør hver
liga isoleret, `os.killpg` ved hæng (0% CPU), retry i senere runder. Spillere upsertes
før hold, så et hold-hæng efterlader stadig spiller-data. Transiente hæng lykkes typisk
ved genforsøg. Samme mønster brugt til heatmaps + formationer (som viste sig langt mere
stabile — næsten ingen hæng).

## Datagotchas fanget ved verifikation

- **ROU-Liga1 forkert Sofascore-id**: søgningen gav 11428 (`Liga 1`), men det er en
  *fase-gruppe* (8 hold, 0 spillere). Det rigtige top-flight-id er **152**
  (`SuperLiga României`). Verificeret ved at fetch gav 18 hold + 528 spillere.
- **"(M)"-FBref-navne igen**: ROU krævede `Liga I (M)` (som Serie B (M)) → 559 spillere.
- **GRE har ingen FBref-spillerdata** for 25/26 (`No objects`) → Sofascore-only, ligesom
  POR-Liga Portugal 2, SVK og SVN (som slet ikke er på FBref).
- Sofascore-crests hentet for alle nye hold (217 nye) på den friske IP; 3 UKR-hold har
  navne-mismatch (crest findes, mangler alias).

## Slutresultat

29 ligaer: **13.647 Sofascore-spillere**, 11.445 FBref-spillere, 10.062 heatmaps, 2.513
formationer. Alle 13 nye ligaer har Sofascore + spatial; 9/13 har også FBref-rygrad.
clubelo var nede → styrke-koefficienter er stadig placeholders (kør `update_coefficients.py`
når clubelo er tilbage).

## Berørte filer

```text
config/leagues.json       +6 ligaer (GRE/SRB/HUN/ROU/SVK/SVN); ROU-id 11428→152; ROU/ITA fbref "(M)"
config/team-logos.json    +217 nye Sofascore-crest-mappings
public/logos/sofascore/   +217 nye crests (frisk IP)
(scratchpad-orchestratorer: run_sofascore_v2, run_spatial — hæng-resiliente per-liga fetches)
```
