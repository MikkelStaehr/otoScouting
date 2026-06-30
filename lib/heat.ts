import type { CSSProperties } from "react";

// Diverging tint vs the median: percentile ≥ 50 = above (muted green),
// < 50 = below (muted clay). Shared by the player + team tables.
export function medianStyle(pct: number | null | undefined): CSSProperties | undefined {
  if (pct == null) return undefined;
  const d = pct - 50;
  const a = (Math.abs(d) / 50) * 0.2;
  return { backgroundColor: d >= 0 ? `rgba(77,124,90,${a})` : `rgba(180,105,74,${a})` };
}
