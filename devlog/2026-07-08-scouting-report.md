# 2026-07-08 — Scouting report (eksporterbar spiller-oneshot)

Idé 2 fra jam-sessionen: en scouting report man kan trække ud fra en spiller — alt
værktøjet ved, på én side, klar til print/PDF (til indslag). Værdi-spændet er
overskriften.

## Hvad

En dedikeret print-venlig side `/report/[key]` (`key` = URL-encoded `hold::spiller`).
Server-komponenten kalder `getPlayerDetail` + `reportInsights` og renderer et
`ReportView`. Åbnes fra spillerkortet ("Rapport ↗", ny fane).

Indhold: header (bio + logo + flag + rolle + OUT) · **auto-narrativ** · **værdi-spænd**
(peer-bandet + TM-markør + signal) · styrker/svagheder · positionerings-heatmap ·
percentil-profil · "Ligner statistisk" + "Ligner i big-5".

## Auto-narrativet

Deterministisk templating (`lib/report.ts`), ingen LLM — gennemsigtigt og
reproducerbart, direkte fra percentil-profilen + værdi-spændet:

> *"20-årig Complete Forward i Super League (Luzern), 1577 min. Vurderet til €3.0m,
> men performer som €7m-profiler (under sine ligemænd — potentiel upside). Stærkest
> på dribling (94p)… Ligner statistisk [X], i big-5 [Y]."*

Styrker/svagheder udledes af de højeste/laveste percentiler i profilen.

## Print

Cream/lyst tema → printer rent som et dokument. `@media print` skjuler toolbaren,
giver hvid side uden baggrundsmønster, og `print-color-adjust: exact` så accent-barer,
crests og heatmap kommer med. `Print / PDF`-knappen kalder `window.print()`.

## Berørte filer

```text
lib/report.ts                  NY — reportInsights(): styrker/svagheder + auto-narrativ
app/report/[key]/page.tsx      NY — server-side rapport-rute
components/report-view.tsx     NY — print-venligt one-pager-layout
components/player-modal.tsx     "Rapport ↗"-link
app/globals.css                @media print (ren side + eksakte farver)
```
