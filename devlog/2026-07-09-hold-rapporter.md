# 2026-07-09 — Hold-rapporter (eksporterbar one-pager)

Ligesom spiller-scout-rapporterne ([[spiller-report]] · `/report/[key]`) har hold nu en
**standalone, print-venlig rapport** (`/team-report/[key]`, key = `league::team`).

Al analysen fandtes allerede i `getTeamReport()` (den driver hold-modalen) — så det var
et narrativ + et view oven på eksisterende data, ikke ny beregning.

## Delene

- **`teamReportInsights(report)`** (i `lib/team-report.ts`) — deterministisk dansk
  resumé, spejler `reportInsights` for spillere: identitet + rating/rank → spillestil
  (med/uden bolden) → stærkest/svagest (hold-metrics) → blødeste defensive zone →
  største rekrutterings-behov + top-kandidat.
- **`app/team-report/[key]/page.tsx`** — server, `getTeamReport(league, team)` →
  `TeamReportView`.
- **`components/team-report-view.tsx`** — one-pageren: header (crest, rating+rank),
  narrativ, KPI-række, spillestil-kort, stærkest/svagest-bjælker, og **rekruttering**
  (de svagest dækkede roller + cross-league-kandidater) — den unikke hold-værdi.
- **`components/team-modal.tsx`** — "Rapport ↗"-link i headeren (som spiller-modalen).

## Eksempel (Middlesbrough)

> Championship, rating 6.88 (#3/24). Med bolden positionsspil/dominans, uden bolden
> gegenpress. Stærkest boldbesiddelse/pasninger/skud, svagest erobringer/luftdueller.
> Blødeste zone: højre side. Behov: No-Nonsense GK — fx Athanasiadis (Grækenland).

Testet: 200, 0,09s varm, narrativ + rekruttering + strengths/weaknesses renderer. tsc rent.

## Berørte filer

```text
lib/team-report.ts             teamReportInsights() — dansk narrativ
app/team-report/[key]/page.tsx  NY — standalone rapport-side
components/team-report-view.tsx NY — print-venlig one-pager
components/team-modal.tsx        "Rapport ↗"-link
```
