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

function score(fn: string, ft: string[], so: { player: string }): number {
  const sn = normName(so.player);
  const st = sn.split(" ");
  const flast = ft[ft.length - 1]!;
  const ffirst = ft[0]![0];
  const slast = st[st.length - 1]!;
  const sfirst = st[0]![0];
  if (sn === fn) return 100;
  if (slast === flast && sfirst === ffirst) return 85;
  const setS = new Set(st);
  let common = 0;
  for (const t of ft) if (setS.has(t)) common++;
  return (common / Math.max(ft.length, st.length)) * 70 + (slast === flast ? 12 : 0);
}

export interface MergeResult<T> {
  /** fb key `${team}::${player}` -> matched Sofascore row */
  map: Map<string, T>;
  matched: number;
  total: number;
}

export function matchSofascore<T extends { player: string; team: string }>(
  fbPlayers: { player: string; team: string }[],
  soPlayers: T[],
): MergeResult<T> {
  const byTeam = new Map<string, T[]>();
  for (const s of soPlayers) {
    const t = normTeam(s.team);
    (byTeam.get(t) ?? byTeam.set(t, []).get(t)!).push(s);
  }

  const map = new Map<string, T>();
  let matched = 0;
  for (const p of fbPlayers) {
    const fn = normName(p.player);
    const ft = fn.split(" ");

    // 1) team-restricted best
    let best: T | null = null;
    let bestScore = 0;
    for (const s of byTeam.get(normTeam(p.team)) ?? []) {
      const sc = score(fn, ft, s);
      if (sc > bestScore) ((bestScore = sc), (best = s));
    }
    // 2) league-wide fuzzy fallback (stricter, catches transfers)
    if (bestScore < 70) {
      best = null;
      bestScore = 0;
      for (const s of soPlayers) {
        const sc = score(fn, ft, s);
        if (sc > bestScore) ((bestScore = sc), (best = s));
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
