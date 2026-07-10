# 2026-07-10 — Positional threat (possession-value-laget, fase 1)

En rumlig værdi-dimension: **hvor farlige zoner en spiller opererer i**, vægtet med xT.
Vi kan ikke lave ægte handlings-baseret xT/VAEP (ingen afleverings-event-streams), men
vores **12×8 sæson-heatmaps aligner præcist med standard-xT-grid'et** — så vi vægter
hver celles aktivitet med dens trussel.

## Hvorfor: dybere roller

Det er et *positionerings*-signal (territorie), ikke handlingsværdi — men det deler
roller FBref's position misser. Valideret:

- Gns. PT: **FW 0.109 > MF 0.076 > DF 0.045 > GK 0.009** (perfekt monoton).
- Inden for **DF**: højest PT = **Hakimi / Rodinei** (angribende backs, 40-50% i angreb);
  lavest = dybe stoppere (0-2%).
- Inden for **MF**: højest = **Salah / Rashford** (fremskudte); lavest = ankre (5-7%).

Så **per-position-percentilen** er det scouting-relevante: Hakimi er 99. pct blandt
forsvarere, Hegland 97. pct blandt midtbaner — *dybere rolle* som ét tal.

## Delene (fase 1)

- **`lib/threat.ts`** — `XT_GRID` (12×8, stiger mod mål, central-løftet), `spatialProfile(grid)`
  → `{ pt, ownThird, attThird }`, og `getAllThreat()` (alle spillere m. heatmap, cachet
  på række-tal som `getAllCentroids`).
- **`getPlayerDetail`** — slår targetens PT op på `sofascore_id`, percentilerer den mod
  same-position-peers i den fulde pulje, tilføjer `threat: { pt, ptPct, attThird }`.
- **Spillerkort** — linje under rollen: "trussel-territorie: fremskudt · 99. pct af
  forsvarere · 43% i angrebstredjedel" (med descriptor meget dyb→meget fremskudt).

## Tilbage (fase 2)

- Fodre **rolle-modellen** med PT/att-tredjedel, så den skelner *angribende back* vs
  *holdende back*, *advanced playmaker* vs *anchor* skarpere.
- Evt. PT som filter/rangliste ("find CB'er der spiller højt") og på Raw DB.
- Forfine xT-grid'et med Karun Singhs publicerede værdier (nu en valideret approksimation).

## Berørte filer

```text
lib/threat.ts              NY — xT-grid + spatialProfile + getAllThreat
lib/similar.ts             PT + per-position-percentil i getPlayerDetail
components/player-modal.tsx  trussel-territorie-linje
```
