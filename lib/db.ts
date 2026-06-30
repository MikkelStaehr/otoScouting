// Read-only access to the local scouting.db via Node's built-in node:sqlite
// (no native dependency). Server-only — never import into a Client Component.

import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";

const DB_PATH = join(process.cwd(), "scouting.db");

// Cache the handle across hot-reloads in dev.
const globalForDb = globalThis as unknown as { _otoDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!existsSync(DB_PATH)) {
    throw new Error(
      `scouting.db not found at ${DB_PATH}. Build it first:\n` +
        `  python pipeline/fetch.py --league DEN-Superliga --season 2025-2026`,
    );
  }
  if (!globalForDb._otoDb) {
    globalForDb._otoDb = new DatabaseSync(DB_PATH, { readOnly: true });
  }
  return globalForDb._otoDb;
}
