# 2026-07-10 — Spillerprofil (composite stil-DNA) + PV-undersøgelsen

En ekstra dimension der **danner et billede af spilleren**: composite stil-felter der
kombinerer de stats vi har til 0-100-dimensioner, som fortæller *hvad slags* spiller —
ikke bare hvad han producerer.

## Vejen hertil (ærlig)

Startede som en **possession-value**-undersøgelse ([[2026-07-10-positional-threat]]).
Konklusion: ægte handlings-baseret xT/VAEP er umuligt (ingen afleverings-event-streams),
men vores 12×8 heatmaps aligner med xT-grid'et, så vi byggede **Positional Threat** —
og valideret at det afslører dybere roller (Hakimi 99. pct blandt forsvarere).

**Men på profilen fungerede PT/territorie ikke:** det var bare heatmap'et vist som tal
(og forvirrede — en kant-kreatør scorer moderat PT fordi brede zoner er lav-xT). PT-
motoren beholdes til **rolle-modellen** (fase 2, hvor "fremskudt back vs dyb CB" giver
værdi), men fjernet fra profil-visningen.

## Det der virkede: composite stil-dimensioner

`lib/profile.ts` — `playerProfile(percentiler)` → 6 dimensioner, hver et vægtet blend af
relevante (ligastyrke-justerede) percentiler:

| Dimension | Blend af |
|---|---|
| **Afslutning** | mål−xG, skud på mål, konvertering |
| **Chanceskabelse** | xA, key passes, store chancer skabt |
| **Føring & dribling** | driblinger, præcise indlæg |
| **Opbygning** | pasnings-%, pasninger, afleveringer i sidste tredjedel |
| **Pres & generobring** | erobringer i angreb, ball recovery, tacklinger |
| **Forsvar** | erobringer, clearances, luftdueller, duel-% |

Renormaliseres over de stats der findes (en dimension droppes hvis alle er null → GK vs
markspiller). Det spatiale kommer ind via de position-iboende stats (erobringer *højt*,
sidste-tredjedels-pasninger).

## Resultat

Valideret: Vicente/Hegland (Wide Playmakers) → **Chanceskabelse 100 · Føring 89-97 ·
Forsvar ~22** = et kreativ-angriber-fingeraftryk med ét blik. De 6 barer *er* spillerens
profil.

Vist som en **"Spillerprofil"-sektion** i modalen (2-kolonne barer, volt ved ≥60).

## Tilbage

- Fase 2: fodre rolle-modellen med PT (dybere roller).
- Evt. tune dimensionerne (vægte / flere: Luftspil, Direkte spil, Involvering).
- Evt. spillerprofil på del-kortet + report.

## Berørte filer

```text
lib/profile.ts              NY — playerProfile() composite stil-dimensioner
lib/similar.ts              profile + threat i getPlayerDetail
components/player-modal.tsx  "Spillerprofil"-sektion (afløser PT/territorie)
lib/threat.ts               (fra tidligere — beholdt til rolle-modellen)
```
