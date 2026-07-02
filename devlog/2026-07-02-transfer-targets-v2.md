# 2026-07-02 — Transfer targets v2: side, bar, bredde

Tre ting fra brug af [[2026-07-02-transfer-targets]].

## Forkert flanke

Meling (venstre-back) fik fire **højre**-backs foreslået — puljen skelnede ikke side.
Tilføjede `side` (L/R/C) til shortlist-puljen, udledt af heatmap-bredden (`sideOf`,
høj cy = venstre). For side-følsomme roller (BACK + WIDE) matches kandidater nu til
den nuværende spillers flanke; centrale roller (GK/CB/MID/STRIKER) filtreres ikke.
Meling → Esquerdinha/Heister/Hiim (venstre), López → Jordy Bos/Araújo (venstre).

## Under 60 = behov

Kvalitets-baren var medianen (~52), så FCK's GK 54 / CB 56 / Backs 55 slap under
radaren selvom det er middelmådigt for et topklub-hold. OUT er en 0-100-skala hvor
~50 er gennemsnit, så **60** er en ærlig "solid startspiller"-bar. FCK viser nu de
fire reelle huller; Bodø/Glimt (stærkt) kun to lige under baren; Vejle (svagt) fem
inkl. GK 22. Stadig cappet til 6 og rangeret efter behov, så svage hold ikke
eksploderer.

## Nøgletal for brede

Da Offensive/Defensive blev stakket lodret, strakte bar-graferne sig over hele
modal-bredden. Kappede kolonnen (`lg:max-w-sm`) og gav kort-banen en fast bredde
ved siden af, så barerne får en læsbar længde i stedet for at flyde ud.

## Berørte filer

```text
lib/shortlist.ts     + side (sideOf fra centroide-cy)
lib/team-report.ts   QUAL_BAR=60 + flanke-matchede kandidater
components/team-modal.tsx  cap nøgletals-bredden
```
