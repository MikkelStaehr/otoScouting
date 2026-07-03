# Devlog

Kronologisk log over hvad der bygges i OtoScout, og hvorfor. Hver post er dateret
og beskriver beslutninger, ikke kun kode — så man et halvt år senere kan forstå
*hvorfor* noget ser ud som det gør.

- **[ARKITEKTUR.md](ARKITEKTUR.md)** — det tekniske referencedokument. Hele
  systemet forklaret: datakilder, pipeline, database, model, frontend. Start her
  hvis du vil forstå hvordan det hænger sammen.

## Poster

- **[2026-06-30](2026-06-30-multi-league-spillere.md)** — Multi-liga spillere
  (Allsvenskan + Eliteserien), kun aktuel sæson, dynamisk overskrift
- **[2026-07-01](2026-07-01-cross-league.md)** — Cross-league sammenligning med
  ligastyrke-justering (Elo-koefficienter, prospekt-finder)
- **[2026-07-01](2026-07-01-league-registry.md)** — Liga-registry: ét sted at
  tilføje ligaer (fundament før skalering til ~18 ligaer)
- **[2026-07-01](2026-07-01-scouting-buildout.md)** — Fra fundament til værktøj:
  16 ligaer i drift, dashboard, forsvars/skabelses-data, spiller-similaritet, logoer
- **[2026-07-02](2026-07-02-liga-udvidelse-og-espn-logoer.md)** — Liga-udvidelse
  16→23 (EU 2. divisioner + østeuropæisk dybde) + ESPN-logo-fallback
- **[2026-07-03](2026-07-03-udvidelse-komplet-frisk-ip.md)** — Udvidelsen komplet
  (29 ligaer): Cloudflare-blok løst via frisk IP + hæng-resiliente orchestratorer
- **[2026-07-03](2026-07-03-db-git-lfs.md)** — Databasen versioneres via Git LFS
  (backup + snapshot-fundament; kvote-afvejning for kadencen)
- **[2026-07-03](2026-07-03-vaerdi-lag-transfermarkt.md)** — Værdi-laget (Fase 1):
  Transfermarkt-markedsværdi for alle 29 ligaer (let scrape, koder verificeret)
- **[2026-07-03](2026-07-03-vaerdi-lag-matcher-ui.md)** — Værdi-laget (Fase 2-4):
  matcher (genbruger Sofascore-merge) + Værdi-kolonne + spillerkort — value-per-output live

## Tidslinje (kort)

Projektet startede som et privat, localhost-only scouting-værktøj til Superligaen
med FBref som eneste kilde. Det er siden vokset:

1. **Fundament** — FBref-pipeline → SQLite → Next.js-tabel med per-90 + percentiler.
2. **Sofascore som 2. kilde** — FBref droppede xG i jan 2026; Sofascore (via
   ScraperFC) bragte rigtig xG/xA/pass%/goals-prevented tilbage. Merges på navn+hold.
3. **Tema + UX** — cream/sort redaktionelt look, alder/nationalitet/flag/logoer,
   komponerbart filtersystem, +Filter-modal, altid-på median-farvning.
4. **Hold-view** — team-performance (Hold) ved siden af Spillere, med afledt hold-xG.
5. **Multi-liga** — Superliga + Allsvenskan + Eliteserien. Hold først, så spillere.
6. **Multi-liga spillere** — spillere i alle 3 ligaer, kun aktuel sæson, dynamisk header.
7. **Cross-league** — sammenligning med ligastyrke-justering (Elo).
8. **(seneste)** — udvidelse mod 23 ligaer (EU 2. divisioner + østeuropæisk dybde);
   FBref-rygrad landede for 6, Sofascore-laget venter på en Cloudflare-blok; ESPN-
   logo-fallback bygget som robusthed imens.
