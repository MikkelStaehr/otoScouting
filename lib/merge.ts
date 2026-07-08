// Match FBref players to Sofascore players (different ids, slightly different
// name/team spellings). Strategy: exact normalised name within the same team,
// then surname+initial, then a league-wide fuzzy fallback. ~90% match on
// Superliga; unmatched players simply get no Sofascore data (shown as "—",
// never guessed).

function normName(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normTeam(s: string): string {
  return normName(s)
    .replace(/\b(fc|if|bk|sk|ik|ob|boldklub|fodbold)\b/g, " ")
    .replace(/kobenhavn/, "copenhagen")
    .replace(/\s+/g, " ")
    .trim();
}

export interface MergeResult<T> {
  /** fb key `${team}::${player}` -> matched Sofascore row */
  map: Map<string, T>;
  matched: number;
  total: number;
}

/** A Sofascore candidate with its name pre-normalised once. normName is expensive
 *  (regex + NFD) and the fuzzy fallback is O(fb × so), so recomputing it per
 *  comparison was the read-layer's hot path — do it once per candidate instead. */
interface Cand<T> {
  s: T;
  sn: string;
  st: string[];
  slast: string;
  sfirst: string;
  set: Set<string>;
}

function scoreCand<T>(fn: string, ft: string[], flast: string, ffirst: string, c: Cand<T>): number {
  if (c.sn === fn) return 100;
  if (c.slast === flast && c.sfirst === ffirst) return 85;
  let common = 0;
  for (const t of ft) if (c.set.has(t)) common++;
  return (common / Math.max(ft.length, c.st.length)) * 70 + (c.slast === flast ? 12 : 0);
}

export function matchSofascore<T extends { player: string; team: string }>(
  fbPlayers: { player: string; team: string }[],
  soPlayers: T[],
): MergeResult<T> {
  const cands: Cand<T>[] = soPlayers.map((s) => {
    const sn = normName(s.player);
    const st = sn.split(" ");
    return { s, sn, st, slast: st[st.length - 1]!, sfirst: st[0]![0]!, set: new Set(st) };
  });
  const byTeam = new Map<string, Cand<T>[]>();
  for (const c of cands) {
    const t = normTeam(c.s.team);
    (byTeam.get(t) ?? byTeam.set(t, []).get(t)!).push(c);
  }

  const map = new Map<string, T>();
  let matched = 0;
  for (const p of fbPlayers) {
    const fn = normName(p.player);
    const ft = fn.split(" ");
    const flast = ft[ft.length - 1]!;
    const ffirst = ft[0]![0]!;

    // 1) team-restricted best
    let best: T | null = null;
    let bestScore = 0;
    for (const c of byTeam.get(normTeam(p.team)) ?? []) {
      const sc = scoreCand(fn, ft, flast, ffirst, c);
      if (sc > bestScore) ((bestScore = sc), (best = c.s));
    }
    // 2) league-wide fuzzy fallback (stricter, catches transfers)
    if (bestScore < 70) {
      best = null;
      bestScore = 0;
      for (const c of cands) {
        const sc = scoreCand(fn, ft, flast, ffirst, c);
        if (sc > bestScore) ((bestScore = sc), (best = c.s));
      }
      if (bestScore < 85) best = null;
    }

    if (best) {
      map.set(`${p.team}::${p.player}`, best);
      matched++;
    }
  }
  return { map, matched, total: fbPlayers.length };
}
