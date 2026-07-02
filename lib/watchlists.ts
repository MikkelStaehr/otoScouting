// Watch lists — user-curated player lists, persisted to data/watchlists.json.
// scouting.db is read-only (scouting data), so this lives in its own writable
// JSON file. Entries key on sofascore_id (stable across re-ingest) with a display
// snapshot (name/team/league) as a fallback + for offline display.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const FILE = join(process.cwd(), "data", "watchlists.json");

export interface WatchEntry {
  sid: number | null; // sofascore_id
  key: string; // `${team}::${player}` fallback
  n: string;
  t: string;
  lg: string;
  note?: string;
  added: string; // ISO date
}
export interface Watchlist {
  id: string;
  name: string;
  created: string;
  players: WatchEntry[];
}
interface Store {
  lists: Watchlist[];
}

function read(): Store {
  try {
    if (!existsSync(FILE)) return { lists: [] };
    const s = JSON.parse(readFileSync(FILE, "utf8")) as Store;
    return s && Array.isArray(s.lists) ? s : { lists: [] };
  } catch {
    return { lists: [] };
  }
}
function write(s: Store): void {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(s, null, 2));
}

export function getWatchlists(): Watchlist[] {
  return read().lists;
}

const newId = () => `l_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const sameEntry = (e: WatchEntry, sid: number | null, key: string) =>
  sid != null ? e.sid === sid : e.key === key;

export type WatchOp =
  | { op: "create"; name: string }
  | { op: "rename"; id: string; name: string }
  | { op: "delete"; id: string }
  | { op: "add"; id: string; entry: WatchEntry }
  | { op: "remove"; id: string; sid: number | null; key: string };

/** Apply a mutation and return the full updated list set. */
export function mutateWatchlists(m: WatchOp): Watchlist[] {
  const store = read();
  const now = new Date().toISOString().slice(0, 10);
  switch (m.op) {
    case "create": {
      const name = m.name.trim() || "Ny liste";
      store.lists.push({ id: newId(), name, created: now, players: [] });
      break;
    }
    case "rename": {
      const l = store.lists.find((x) => x.id === m.id);
      if (l) l.name = m.name.trim() || l.name;
      break;
    }
    case "delete": {
      store.lists = store.lists.filter((x) => x.id !== m.id);
      break;
    }
    case "add": {
      const l = store.lists.find((x) => x.id === m.id);
      if (l && !l.players.some((e) => sameEntry(e, m.entry.sid, m.entry.key))) {
        l.players.push({ ...m.entry, added: m.entry.added || now });
      }
      break;
    }
    case "remove": {
      const l = store.lists.find((x) => x.id === m.id);
      if (l) l.players = l.players.filter((e) => !sameEntry(e, m.sid, m.key));
      break;
    }
  }
  write(store);
  return store.lists;
}
