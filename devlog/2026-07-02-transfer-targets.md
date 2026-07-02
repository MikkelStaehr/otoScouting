# 2026-07-02 — Transfer targets: kun ved reelt behov

"Opgradér-mål" hed før det og viste altid *svageste rolle pr. kæde* — også når den
"svageste" var Moukoko som Poacher til 77. Meningsløst: en target skal kun dukke op
når der er et **behov**. Døbt om til **Transfer targets** og gav den to triggere.

## 1. Kvalitet — under medianen

En rolle bliver en target hvis holdets bedste spiller i rollen ligger **under
cross-league-medianen** for OUT. Medianen regnes dynamisk og adskilt: markspillere
≈52, keepere ≈53 (de scorer på hver sin skala). FCK: kun Pressing Full-Back (Meling
42) er under baren — GK 54, CB 56, resten 71-80 forsvinder. Silkeborg (svagere hold)
får tre ægte huller (CB 42, DLP 43, Shot-Stopper 50).

## 2. Dybde — tynd kæde

Talt fra den **fulde trup pr. kædeposition**, ikke fra rollerne — netop pointen om at
FCK har 5 CB'er i truppen men kun 3 med nok minutter til at få en rolle. En kæde er
tynd hvis den har under {DF:5, MF:4, FW:2} spillere med ≥450 min. **GK udeladt** —
backup-keepere spiller sjældent 450+ ligaminutter, så hvert hold ville se tyndt ud;
keepere er derfor et rent kvalitets-signal. (Dybde er konservativ og afhænger af
friske trupper — den bliver først for alvor skarp i august.)

Hver target bærer en `reason` (`kvalitet` / `dybde` / `begge`) vist som lille tag
("svag profil" / "tynd trup" / "svag + tynd"). Dybde-targets viser bedste profiler i
rollen (tilføj en krop); kvalitets-targets kun spillere klart over den nuværende.
Intet behov → **empty state** ("truppen er dækket ind") — Bodø/Glimt viser den, og
det er et ærligt svar, ikke en fejl.

## Berørte filer

```text
lib/team-report.ts        need-baserede targets (median-tærskel + kæde-dybde) + reason
components/team-modal.tsx  rename → Transfer targets, reason-tag, empty state
```
