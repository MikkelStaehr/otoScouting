# 2026-07-02 — Radar-sammenligning fra watchlists

Lille etape oven på rekrutteringsgrenen ([[2026-07-02-shortlist-watchlists]]):
saml kandidater på en watchlist og læg dem oven på hinanden. Svarer på "hvem af
de her henter vi".

## Hvad

I **Shortlist → Watchlists** har hver spiller nu en afkrydsning. Vælg **2-3
spillere** (gerne på tværs af lister) → en compare-tray dukker op nederst →
**"Radar →"** åbner sammenligningen:

- **Radar-overlay** af percentil-profilerne, op til 3 serier (ink / slate-blå /
  clay).
- **Nøgletal-tabel** ved siden: per-90 + percentil pr. akse, med højeste værdi
  fremhævet i hver række.
- **Automatisk akse-sæt**: markspiller-akser (mål/xG/xA/chances/dribl/pass%/
  tackling/erobring/luft/duel%) eller målmands-akser hvis alle valgte er GK.

## Detaljer

- Genbruger den kompakte `ShortlistPlayer`-payload (percentiler + per-90), så
  ingen ekstra hentning — sammenligningen er øjeblikkelig.
- `components/radar-compare.tsx` er skrevet generisk (2-3 spillere, egen
  ComparePlayer-form), så den senere også kan hænges på søgeresultaterne, ikke
  kun watchlists. Den eksisterende 2-spiller `CompareOverlay` i databasen er
  bundet til fulde `EnrichedPlayer` og forblev urørt.
- Udvælgelse kan spænde over flere lister; maks 3; tray med ryd/fjern.

## Berørte filer

```text
components/radar-compare.tsx   NY — radar + tabel for 2-3 spillere (ShortlistPlayer)
components/shortlist-view.tsx  + udvælgelse i Watchlists-fanen + compare-tray
```
