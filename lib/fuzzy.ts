// Tiny dependency-free fuzzy matcher. Subsequence match with scoring that
// rewards contiguous runs, word-boundary starts, and early matches. Good enough
// for a few hundred competition+season rows — no need for a library.

export interface FuzzyResult<T> {
  item: T;
  score: number;
  /** Indices in the target string that matched, for highlighting. */
  matches: number[];
}

/** Returns a score (higher = better) and matched indices, or null if no match. */
export function fuzzyScore(query: string, target: string): { score: number; matches: number[] } | null {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (q.length === 0) return { score: 0, matches: [] };

  const matches: number[] = [];
  let score = 0;
  let ti = 0;
  let prevMatch = -2;

  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]!;
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;

    // Base point for the match.
    score += 1;
    // Contiguous run bonus.
    if (found === prevMatch + 1) score += 4;
    // Word-boundary bonus (start of string or after a separator).
    const before = found > 0 ? t[found - 1]! : " ";
    if (found === 0 || /[\s\-/.,()]/.test(before)) score += 3;
    // Penalise gaps so earlier, tighter matches win.
    if (found > ti) score -= Math.min(found - ti, 3) * 0.5;

    matches.push(found);
    prevMatch = found;
    ti = found + 1;
  }

  // Slight preference for shorter targets (a tighter overall match).
  score -= target.length * 0.01;
  return { score, matches };
}

export function fuzzyFilter<T>(
  query: string,
  items: T[],
  keyOf: (item: T) => string,
): FuzzyResult<T>[] {
  const q = query.trim();
  if (q.length === 0) {
    return items.map((item) => ({ item, score: 0, matches: [] }));
  }
  const out: FuzzyResult<T>[] = [];
  for (const item of items) {
    const res = fuzzyScore(q, keyOf(item));
    if (res) out.push({ item, score: res.score, matches: res.matches });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}
