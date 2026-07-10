// Deterministic social-media caption for a player, built from the same data as the
// scout report. A ready-to-paste post (hook + standout stats + value + comp), Danish
// voice. The share card renders the visual; this is the text beside it.

import type { PlayerDetail } from "./similar.ts";
import { leagueLabel } from "./league-meta.ts";

function euro(v: number | null | undefined): string {
  if (v == null) return "ukendt";
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}m`;
  if (v >= 1_000) return `€${Math.round(v / 1_000)}k`;
  return `€${v}`;
}

/** Plain-language "how good" for a percentile — what a casual viewer actually gets. */
export function topPhrase(pct: number): string {
  if (pct >= 99.9) return "flest i 30 ligaer";
  return `top ${Math.max(1, Math.round(100 - pct))}% i 30 ligaer`;
}

/** Per-90 count (2 dp under 1, else 1 dp) or a rate as a %. */
export function fmtStat(label: string, value: number): string {
  if (/%|pct|præcis|besidd/i.test(label)) return `${Math.round(value)}%`;
  return `${value < 1 ? value.toFixed(2) : value.toFixed(1)}/90`;
}

export function shareCaption(d: PlayerDetail): string {
  const stats = d.groups
    .flatMap((g) => g.stats)
    .filter((s) => s.value != null && s.pct != null) as { label: string; value: number; pct: number }[];
  const top = [...stats].sort((a, b) => b.pct - a.pct)[0];
  const role = d.role?.primary?.role ?? d.pos ?? "spiller";
  // Relatable season totals (counting stats only) — "9 kampe · 2 mål · 7 assists".
  const totals = d.flat
    .filter((f) => f.value != null && !f.pct)
    .slice(0, 3)
    .map((f) => `${f.value} ${f.label.toLowerCase()}`)
    .join(" · ");

  const lines: string[] = [];
  lines.push(`🔍 ${d.player}${d.age != null ? ` (${d.age})` : ""} · ${d.team}, ${leagueLabel(d.league)}`);
  if (totals) lines.push(`${totals}.`);
  if (top)
    lines.push(`${top.label} ${fmtStat(top.label, top.value)} — ${topPhrase(top.pct)}.`);
  if (d.marketValue != null && d.valueSpread)
    lines.push(`Vurderet ${euro(d.marketValue)} — men leverer som ${euro(d.valueSpread.median)}-profiler.`);
  else if (d.marketValue != null) lines.push(`Vurderet ${euro(d.marketValue)}.`);

  const bio = [role];
  if (d.height != null) bio.push(`${d.height} cm`);
  lines.push(`${bio.join(" · ")}.`);

  const big5 = d.benchmarkSimilar[0];
  if (big5) lines.push(`Statistisk tvilling i big-5: ${big5.player}.`);

  lines.push(`\n📊 OtoScout · OUT ${d.out ?? "—"} · #scouting #hiddengem`);
  return lines.join("\n");
}
