# 2026-07-02 — Hold-roller: spillestil + rolle-sammensætning

Hold-siden af rolle-motoren, i to etaper: først holdets **spillestil/identitet**
(à la FM26 — én rolle med bolden, én uden), så **rolle-sammensætning + huller**
der binder hold-stil, spiller-roller og rekruttering sammen.

## Etape 1 — Spillestil (IP + OOP)

Nøgleindsigten (stjålet fra FM26): et holds stil er sjældent én ting — Atalanta ≈
City med bolden, vidt forskellige uden. Så hvert hold får **to stile**: én i
boldbesiddelse (IP), én uden (OOP). Regelbaseret term-scoring (gennemskueligt, som
spiller-rollerne) med et "hvorfor".

- **Med bolden (IP):** Positionsspil/dominans · Vertikal transition · Direkte spil ·
  Kantfokuseret · Kaosbold/andenbolde.
- **Uden bolden (OOP):** pres-højde-aksen vi rent faktisk kan læse — Højtryk/
  gegenpress · Midterblok · Lavblok. **Mandsopdækkende udeladt** — kan ikke skelnes
  fra "vinder bare mange dueller" (kvalitets- ikke stil-signal).

**Ærlige forbehold:** ingen PPDA / sekvenser / transition-xG (kræver event-data).
Så pres proxy'es via erobringer højt (`poss_won_att_third`), directness via lange
bolde, kantfokus via indlægsvolumen, kaos via luftdueller + hjørnespark.

Verificeret: **Midtjylland = Kaosbold/andenbolde** (deres DNA), Bodø/Glimt =
Positionsspil, Schalke = Vertikal transition. Sund fordeling over 242 hold
(OOP: Midterblok 108 / Højtryk 79 / Lavblok 55). Vist som to kort i rapporten.

## Etape 2 — Rolle-sammensætning + opgradér-mål

Ny **"Roller"-tab** i holdrapporten:

- **Rolle-sammensætning** — truppen grupperet efter datadrevet rolle, pr. kæde,
  bedste OUT pr. rolle. Hvilke profiler holdet har (farve = kvalitet).
- **Opgradér-mål** — de svagest-dækkede roller + spillere med samme rolle og højere
  OUT fra andre klubber på tværs af ligaer. Klikbare + ⭐-watchlist. Bringer
  "prospects" tilbage, nu rolle-baseret og over hele banen.

Genbruger shortlist-payloadet (cached) som rolle-pulje. Verificeret: Silkeborgs
svageste rolle = Deep-Lying Playmaker (Larsen 43) → Þórðarson 77 / Rosengren 76 /
Davy Gui 76 (GER/SWE/POR).

## Kæden hænger sammen nu

Hold-stil (hvordan) → rolle-sammensætning (hvilke profiler) → huller (hvad mangler)
→ kandidater (hvem) → watchlist (følg). Bygger bro fra taktik til rekruttering.

## Berørte filer

```text
lib/team-style.ts     NY — IP + OOP stil-klassificør (term + why)
lib/team-report.ts    + style, roleMakeup, roleUpgrades
lib/role-meta.ts      + ROLE_BUCKET / BUCKET_LABEL / BUCKET_ORDER
components/team-modal.tsx  StyleCard (2 stil-kort) + Roller-tab (sammensætning + opgradér)
```
