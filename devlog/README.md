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
- **[2026-07-03](2026-07-03-dedup-spillere.md)** — Dublet-spillere: FBref-dobbeltlistning
  (samme liga) + cross-league-transfers, begge deduperet via Sofascore-id
- **[2026-07-03](2026-07-03-styrke-fra-transfermarkt.md)** — Ligastyrke fra Transfermarkt-
  medianværdi (clubelo droppet: nede + ufuldstændig; r≈0,84, uafhængigt af eksterne servere)
- **[2026-07-08](2026-07-08-big5-benchmark-tier.md)** — Big-5 som benchmark-tier: ankrer
  styrke-skalaen til virkeligheden (log, PL=1,0), men holdt ude af scouting-puljen
- **[2026-07-08](2026-07-08-sammenlign-mod-big5.md)** — FBref-huller lukket (POL/GRE/Serie A)
  + "Ligner i big-5" (sammenlign dev-profil mod benchmark-spillere)
- **[2026-07-08](2026-07-08-vaerdi-spaend.md)** — Værdi-spænd: comp-baseret værdisætning
  (peer-fordeling vs TM-værdi → upside/præmie-signal; retning = trend-linje)
- **[2026-07-08](2026-07-08-scouting-report.md)** — Scouting report: eksporterbar spiller-
  oneshot (auto-narrativ + værdi-spænd + profil), print-venlig til indslag
- **[2026-07-08](2026-07-08-performance-readlag.md)** — Performance: read-laget 17s→2s kold
  (memoiséret matchning, cachet prepareRows, forrige snapshot loadet én gang)
- **[2026-07-08](2026-07-08-performance-payload.md)** — Performance: "Alle ligaer"-payload
  60→22 MB + windowing (render 150 rækker, ikke 8.000)
- **[2026-07-08](2026-07-08-ingest-ui.md)** — Opdater data fra appen: ingest-UI i
  Indstillinger (detached run + live progress, status-fil)
- **[2026-07-08](2026-07-08-wal-mode.md)** — "database is locked" fix: WAL-mode så
  ingest-skrivning ikke låser appens reads (delt pipeline/db.py + busy_timeout)
- **[2026-07-09](2026-07-09-localhost-wins.md)** — Raw DB-windowing (11,5s→1,8s) +
  index på history(snapshot_id)
- **[2026-07-09](2026-07-09-bedste-xi.md)** — Bedste XI (fase 1): bedste spiller pr.
  position i en 4-3-3 på tværs af ligaerne, på en bane
- **[2026-07-09](2026-07-09-hold-rapporter.md)** — Hold-rapporter: eksporterbar
  print-one-pager pr. hold (narrativ + rekruttering), som spiller-scout-reports
- **[2026-07-09](2026-07-09-cross-league-hold.md)** — Table of Justice for hold:
  cross-league hold-rangering (strength-justeret composite score)
- **[2026-07-09](2026-07-09-hojde-fod.md)** — Højde + foretrukken fod fra Sofascore
  (player_bio + backfill + visning i kort/rapport)
- **[2026-07-09](2026-07-09-del-kort.md)** — Del-kort til SoMe: brandet spiller-PNG
  (html-to-image) + deterministisk caption, isoleret rute /del
- **[2026-07-09](2026-07-09-soegning.md)** — ⌘K søger nu alle 30 ligaer (index
  hentet på første åbning, ude af per-side-payload)
- **[2026-07-10](2026-07-10-positional-threat.md)** — Positional threat: heatmap×xT
  rumligt værdi-lag der afslører dybere roller (fremskudt/dyb pr. position)

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
