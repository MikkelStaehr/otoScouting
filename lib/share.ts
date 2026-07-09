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

export function shareCaption(d: PlayerDetail): string {
  const stats = d.groups
    .flatMap((g) => g.stats)
    .filter((s) => s.pct != null) as { label: string; pct: number }[];
  const top = [...stats].sort((a, b) => b.pct - a.pct).slice(0, 2);
  const role = d.role?.primary?.role ?? d.pos ?? "spiller";

  const lines: string[] = [];
  lines.push(`🔍 ${d.player}${d.age != null ? ` (${d.age})` : ""} · ${d.team}, ${leagueLabel(d.league)}`);
  if (top.length)
    lines.push(`${top.map((s) => `${s.label.toLowerCase()} ${s.pct}. pct`).join(" · ")} på tværs af 30 ligaer.`);
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
