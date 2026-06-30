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
6. **(denne post)** — spillere i alle 3 ligaer, kun aktuel sæson, dynamisk header.
