// Scouting-report insights: derive strengths, weaknesses and a plain-language
// narrative from a PlayerDetail. Deterministic templating (no LLM) — transparent
// and reproducible, straight from the percentile profile + value spread.

import type { PlayerDetail } from "./similar.ts";
import { leagueLabel } from "./league-meta.ts";

export interface ReportInsights {
  strengths: { label: string; pct: number }[];
  weaknesses: { label: string; pct: number }[];
  narrative: string;
}

function euro(v: number | null | undefined): string {
  if (v == null) return "ukendt værdi";
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}m`;
  if (v >= 1_000) return `€${Math.round(v / 1_000)}k`;
  return `€${v}`;
}

export function reportInsights(d: PlayerDetail): ReportInsights {
  const stats = d.groups
    .flatMap((g) => g.stats)
    .filter((s) => s.pct != null) as { label: string; pct: number }[];
  const strengths = [...stats].sort((a, b) => b.pct - a.pct).slice(0, 3).map((s) => ({ label: s.label, pct: s.pct }));
  const weaknesses = [...stats].sort((a, b) => a.pct - b.pct).filter((s) => s.pct <= 30).slice(0, 2).map((s) => ({ label: s.label, pct: s.pct }));

  const role = d.role?.primary?.role ?? d.pos ?? "spiller";
  const parts: string[] = [];
  parts.push(`${d.age ?? "?"}-årig ${role} i ${leagueLabel(d.league)} (${d.team}), ${d.minutes} min i sæsonen.`);

  const vs = d.valueSpread;
  if (d.marketValue != null && vs) {
    const signal =
      d.marketValue < vs.median
        ? "under sine ligemænd — potentiel upside"
        : d.marketValue > vs.p75
          ? "over sine ligemænd — en markeds-præmie"
          : "på linje med sine ligemænd";
    parts.push(`Vurderet til ${euro(d.marketValue)}, men performer som ${euro(vs.median)}-profiler (${signal}).`);
  } else if (d.marketValue != null) {
    parts.push(`Vurderet til ${euro(d.marketValue)}.`);
  }

  if (strengths.length) {
    parts.push(`Stærkest på ${strengths.map((s) => `${s.label.toLowerCase()} (${s.pct}p)`).join(", ")}.`);
  }
  if (weaknesses.length) {
    parts.push(`Svagest på ${weaknesses.map((s) => s.label.toLowerCase()).join(", ")}.`);
  }

  const like = d.similar[0];
  const big5 = d.benchmarkSimilar[0];
  if (like || big5) {
    const bits: string[] = [];
    if (like) bits.push(`${like.player} (${leagueLabel(like.league)})`);
    if (big5) bits.push(`i big-5 ${big5.player}`);
    parts.push(`Ligner statistisk ${bits.join(", ")}.`);
  }

  return { strengths, weaknesses, narrative: parts.join(" ") };
}
