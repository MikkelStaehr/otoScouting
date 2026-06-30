# OtoScout — Arkitektur

Teknisk referencedokument. Hvad systemet er, hvordan data flyder, og hvorfor
tingene er bygget som de er.

---

## 1. Hvad det er

OtoScout er et **lokalt, single-user fodbold-scouting-værktøj**. Det kører kun på
din egen maskine (localhost), bliver aldrig deployet, har ingen login, ingen sky,
ingen brugere ud over dig. Det er bevidst.

Filosofien er **value-per-output**: i stedet for at vise rå tal viser det hvor god
en spiller er *relativt til sine ligakammerater* (percentiler), normaliseret per
90 minutter, så en der spiller 600 minutter kan sammenlignes med en der spiller
3000.

Tre ligaer dækkes nu: **Superliga (DEN)**, **Allsvenskan (SWE)**, **Eliteserien
(NOR)** — valgt fordi prospekt-jagt kræver flere ligaer at sammenligne på tværs af.

## 2. Teknologi-stak

| Lag | Valg | Hvorfor |
|-----|------|---------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind v4 | Server components læser DB direkte; ingen separat API nødvendig |
| Database | SQLite (`scouting.db`) | Én fil, ingen server, perfekt til lokal single-user |
| DB-driver | `node:sqlite` (Nodes indbyggede) | Ingen native dependency at kompilere |
| Pipeline | Python (soccerdata + ScraperFC) | De bedste gratis kilder til fodbolddata |

## 3. Datakilder

To kilder, kørt ved siden af hinanden — de udfylder hinandens huller:

### FBref (via `soccerdata`)

Den oprindelige kilde. Giver **rygraden**: hver spiller med spilletid, plus
biografi (alder, position, nationalitet, fødselsår) og tælle-statistik (mål,
assists, skud, tacklinger osv.).

- **Vigtigt:** FBref omstrukturerede i januar 2026 og **fjernede xG** samt
  Defense/Passing/Possession-tabellerne. Derfor kun de tællestats der overlevede
  (standard / shooting / misc / keeper).
- Langsom: scraper med rate-limiting, og igangværende sæsoner re-scrapes (ingen
  cache). ~3–10 min per liga.

### Sofascore (via `ScraperFC`)

Den anden kilde, tilføjet da FBref tabte xG. Opta-stil data: **rigtig xG, xA,
pass%, long balls, chances created, big chances, goals prevented** og rigtige
defensive dueller. Én API-kald, ingen browser, Cloudflare-bypass håndteres af
ScraperFC. Hurtig (~30 sek for alle ligaer).

Sofascore identificeres per liga med en "unique-tournament" id:
Superliga = 39, Allsvenskan = 40, Eliteserien = 20.

## 4. Pipeline (Python → SQLite)

```text
pipeline/
  fetch.py            FBref → players-tabellen
  fetch_sofascore.py  Sofascore → sofascore_players + sofascore_teams
  schema.sql          players-skema
  schema_sofascore.sql sofascore_players-skema
  schema_teams.sql    sofascore_teams-skema
  snapshots.py        arkiverer forrige hentning før overskrivning
```

### Multi-liga / multi-sæson mønster (vigtigt)

Hver tabel er `CREATE TABLE IF NOT EXISTS` (droppes **aldrig**) og har `league` i
sin PRIMARY KEY. En hentning gør:

```sql
DELETE FROM <tabel> WHERE league = ? AND season = ?;
INSERT  ... ;   -- kun den (liga, sæson) der lige blev hentet
```

Så at hente Eliteserien rører ikke Superligaen, og en ny sæson sletter ikke den
gamle. Det er sådan "gem den gamle data når en ny sæson starter" virker — gratis.

> **Historisk fælde:** `schema.sql` havde oprindeligt `DROP TABLE IF EXISTS players`,
> så den FØRSTE multi-liga-hentning ville have slettet alt undtagen den sidst hentede
> liga. Rettet til no-drop 2026-06-30.

### Sæsonkoder

Begge kilder normaliseres til samme kode, så de kan parres:

| Liga | Kalender | Sofascore input | FBref input | Kode | Label |
|------|----------|-----------------|-------------|------|-------|
| Superliga | Tværår (jul–maj) | `25/26` | `2025-2026` | `2526` | 2025/2026 |
| Allsvenskan | Kalenderår (mar–nov) | `2026` | `2026` | `2026` | 2026 |
| Eliteserien | Kalenderår (mar–dec) | `2026` | `2026` | `2026` | 2026 |

At koderne matcher er dét der gør, at **én liga-vælger kan styre både Spillere
(FBref) og Hold (Sofascore)**.

### soccerdata custom leagues (fælde)

Ligaer der ikke er indbygget i soccerdata skal registreres i
`~/soccerdata/config/league_dict.json`. Men soccerdata indlæser den fil ved
**import-tid** — så første kørsel efter tilføjelse skriver filen men fejler stadig
(`Invalid league`); anden kørsel virker. De nordiske er kalenderår-ligaer, så
`season_start`/`season_end` (Mar/Nov, Mar/Dec) fortæller soccerdata at sæsonen er
et enkelt år.

### Alder-parsing (fælde)

FBref leverer alder som `"YY-DDD"` (år-dage, fx `"20-178"`) for en igangværende
sæson, men som et rent heltal for en afsluttet. `pd.to_numeric` lavede "20-178" om
til NaN → 0. Løst med en `ages()`-helper (split på "-") plus et fallback der
udleder alder af fødselsår (`sæson-slut-år − born`).

## 5. Database (`scouting.db`)

| Tabel | Indhold |
|-------|---------|
| `players` | FBref: én række per spiller per (liga, sæson). Biografi + tællestats. |
| `sofascore_players` | Sofascore: rig per-spiller statistik (xG/xA/pass% osv.). |
| `sofascore_teams` | Sofascore: én række per hold (for+imod spejlet, ~117 kolonner). |
| `*_history` | Snapshots af tidligere hentninger (til Δ-sammenligning). |
| `snapshots` | Metadata om hvert snapshot (tidsstempel, kilde). |

Rå tællestats lagres; **per-90, percentiler og value-modellen beregnes i Node ved
læsning, aldrig gemt** — så modellen kan ændres uden at hente data igen.

## 6. Read-lag (Node/TypeScript)

```text
lib/
  db.ts           node:sqlite handle (readOnly, cachet over hot-reload)
  players.ts      getEnrichedPlayers(liga, sæson) → spiller-board
  teams.ts        getTeams(liga, sæson) → hold-board m. afledt xG
  model.ts        enrichPlayers() — per-90, percentiler, OUT-score
  merge.ts        matcher FBref-spillere til Sofascore (navn+hold)
  metrics.ts      spiller-metrik-definitioner
  team-metrics.ts hold-metrik-definitioner (ren, ingen DB-import)
  heat.ts         median-farvning (grøn over / clay under median)
  team-logos.ts   holdnavn → ESPN crest-url
  flags.ts        nationalitet → flag
  types.ts        delte typer
```

### node:sqlite null-prototype fælde (vigtigt)

`node:sqlite` returnerer rækker med **null-prototype**. Sådanne objekter kan
**ikke** sendes fra en server component til en client component ("Only plain
objects can be passed..."). Derfor mapper read-laget altid rækker til almindelige
objekter (`rows.map(r => ({ ...r }))`) før de krydser server→client-grænsen.

## 7. Value-modellen (`config/model.json`)

Læses per request, så vægte/grupper kan justeres live (bare refresh — ingen build).

- **Percentiler beregnes inden for en POOL**: markspillere rangeres mod
  kvalificerede markspillere, målmænd mod kvalificerede målmænd. En målmands 0 mål
  rangeres aldrig mod markspillere.
- **Kvalifikation**: `minMinutes` (450) — for lidt spilletid → ingen percentil.
- **per-90**: tællestats normaliseres `(værdi × 90) / minutter`. `rates` (fx
  save%) vises som de er. `invert` (lavere-er-bedre, fx mål imod) får vendt
  percentil, så grøn altid = godt.
- **Derived ratios** (beregnet, ikke gemt): conv%, sot%, g/sot, og **g−xG**
  (finishing vs forventning — rigtig nu hvor vi har Sofascore-xG). Null under en
  minimumsstikprøve, så "1 skud, 1 mål = 100%" ikke udgiver sig for elite.
- **OUT-score**: vægtet gennemsnit af percentiler. Markspillere scores på output
  (npg, assists, skud...), målmænd på `keeperScore` (goals prevented, save%,
  clean sheets...).

## 8. Merge: FBref ↔ Sofascore

Kilderne har forskellige id'er og let forskellige navne/stavemåder. `merge.ts`
matcher i tre trin: (1) eksakt normaliseret navn inden for samme hold, (2)
efternavn+initial, (3) liga-bred fuzzy fallback (strengere, fanger transfers).
Umatchede spillere får simpelthen ingen Sofascore-data (vist som "—", aldrig
gættet). ~95% match på Eliteserien.

## 9. Frontend

```text
app/
  page.tsx            server component (force-dynamic) — læser DB, vælger liga
  layout.tsx          rod-layout
  api/refresh/route.ts on-demand re-fetch (spawner Python)
components/
  board-switch.tsx    client: Spillere/Hold-toggle + liga-vælger + header
  player-table.tsx    client: spiller-tabel (filtre, faner, median-heat)
  team-table.tsx      client: hold-tabel
  settings-modal.tsx  client: refresh-knap + snapshot-info
  command-palette.tsx ⌘K søgning
  compare-overlay.tsx spiller-sammenligning
  site-header.tsx     top-bar
```

### Server/client-deling

`page.tsx` er en **async server component** med `force-dynamic` — den læser
`scouting.db` på hver request (så en refresh eller en model-tweak vises straks).
Den løser den valgte (liga, sæson) fra URL'ens `searchParams`, henter både
spillere og hold for den, og sender plain-mapped data ned til `BoardSwitch`.

### Én vælger, to boards

`BoardSwitch` (client) har Spillere/Hold-toggle og liga-knapper. Et klik på en liga
laver `router.push(/?league=...&season=...)`, hvilket re-renderer server-siden med
den nye (liga, sæson). Fordi FBref og Sofascore deler sæsonkode, skifter **begge**
boards. Headeren læser den valgte liga (→ "NOR · Eliteserien") og skifter
tæller-enhed mellem "hold" og "spillere" efter fanen.

### Median-farvning

Altid på. Percentil ≥ 50 = over median (grøn), < 50 = under (clay/orange). Delt
mellem spiller- og holdtabeller via `lib/heat.ts`.

## 10. Refresh (on-demand)

`app/api/refresh/route.ts` spawner Python-pipelines og streamer fremskridt tilbage
til settings-modalen (newline-delimited JSON). Sofascore kører som standard (hurtig);
FBref kun hvis man tjekker boksen (langsom). Hver hentning arkiverer forrige som et
snapshot, så Δ-chips kan vise ændring siden sidst. Multi-liga: Sofascore henter alle
ligaer; FBref kører et step per liga.

## 11. Logoer & flag

- **Crests**: ESPN's åbne CDN (`a.espncdn.com`), keyet på normaliseret holdnavn.
  Fordi FBref og Sofascore staver hold forskelligt, har mappet begge varianter →
  samme id. Alle 44 klubber (12+16+16) dækket.
- **Flag**: flagcdn, keyet på ISO-landekode.

## 12. Kør lokalt

```bash
# Hent data (Sofascore alle ligaer; hurtigt)
python pipeline/fetch_sofascore.py

# Hent FBref per liga (langsomt — kør i baggrunden)
python pipeline/fetch.py --league DEN-Superliga   --season 2025-2026
python pipeline/fetch.py --league SWE-Allsvenskan --season 2026
python pipeline/fetch.py --league NOR-Eliteserien --season 2026

# Kør appen (pin porten!)
npx next dev -p 3000
```

## 13. Udviklings-gotchas (samlet)

- **Kør aldrig `npm run build` mens dev-serveren kører** — det korrumperer `.next`.
  Brug `npx tsc --noEmit` til typecheck i stedet.
- **Pin porten** (`-p 3000`) — ellers hopper dev-serveren til en ny port hver gang.
- **node:sqlite null-prototype** — map altid til plain objects før client-grænsen.
- **soccerdata config læses ved import** — ny custom league kræver to kørsler.
- **FBref alder = "YY-DDD"** for igangværende sæson — parse, ellers bliver det 0.
- **Windows cp1252 console** crasher på nordiske tegn — `sys.stdout.reconfigure(encoding="utf-8")`.
