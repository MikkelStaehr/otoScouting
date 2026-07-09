# 2026-07-09 — To localhost-wins: Raw DB-windowing + history-index

De to småting vi parkerede under ingest-arbejdet.

## 1. Raw DB (/database) — 11,5s → 1,8s

`RawDatabase` renderede *alle* 15.303 rækker × ~30 kolonner i DOM'en — den var
faktisk værre end boardet var (37 MB, hvoraf broderparten var renderet HTML-markup).
Samme windowing som [[2026-07-08-performance-payload]], men observeren bruger tabellens
egen `overflow-auto`-container som `root` (tabellen scroller indeni, ikke siden).
Render 200 rækker, voks +300 når en sentinel scroller nær bunden; CSV-eksport +
tæller kører stadig på hele `filtered`.

| /database | Før | Nu |
|---|---|---|
| Tid (varm) | 11,5s | **1,8s** |
| Payload | 37 MB | **3,3 MB** |
| DOM-rækker | ~15.300 | 200 (+scroll) |

## 2. Index på `*_history(snapshot_id)`

`loadPrevSnapshot` (Δ-form vs sidste hentning) læser `sofascore_players_history`
efter `snapshot_id` (`MAX(...)` + `WHERE snapshot_id=?`) — uden index en fuld scan
af ~300k rækker. Tilføjet i `snapshots.archive()` (idempotent `CREATE INDEX IF NOT
EXISTS`), så alle history-tabeller + fremtidige builds får det. Query-planen gik fra
`SCAN` til `SEARCH ... USING INDEX`.

## Sidebemærkning: WAL i praksis

At sætte indexet mens dev-serveren kørte gav `database is locked` — en tung
index-bygning på 300k rækker mod en åben readOnly-handle. Sat med serveren nede i
stedet (0,57s). Den *rigtige* ingest (korte INSERTs) kørte fint med appen åben, så
WAL + busy_timeout dækker den normale samtidighed; kun en enkelt lang skrive-DDL
kan trænge sig.

## Berørte filer

```text
components/raw-database.tsx   windowing (renderLimit + sentinel, root = scroll-container)
pipeline/snapshots.py         CREATE INDEX idx_{hist}_sid i archive()
scouting.db                   index anvendt lokalt (ikke committet — LFS)
```
