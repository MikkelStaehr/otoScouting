"use client";

import { useRouter } from "next/navigation";
import { leagueLabel } from "@/lib/league-meta";

const METRICS = [
  { key: "season", label: "Sæson" },
  { key: "form", label: "Form" },
];
const LENSES = [
  { key: "samlet", label: "Samlet" },
  { key: "u21", label: "U21" },
  { key: "bargain", label: "Bargain" },
  { key: "nation", label: "Nation" },
  { key: "liga", label: "Liga" },
];

export function BestXIControls({
  metric,
  lens,
  nation,
  league,
  nations,
  leagues,
}: {
  metric: string;
  lens: string;
  nation: string;
  league: string;
  nations: { code: string; count: number }[];
  leagues: { key: string; count: number }[];
}) {
  const router = useRouter();

  // Build a URL from the current state with the given overrides — so switching one
  // axis (metric / lens / dropdown) preserves the others.
  const urlFor = (over: Partial<{ metric: string; lens: string; nation: string; league: string }>) => {
    const m = over.metric ?? metric;
    const l = over.lens ?? lens;
    const p = new URLSearchParams();
    if (m === "form") p.set("metric", "form");
    p.set("lens", l);
    if (l === "nation") p.set("nation", (over.nation ?? nation) || nations[0]?.code || "");
    if (l === "liga") p.set("league", (over.league ?? league) || leagues[0]?.key || "");
    return `/bedste-xi?${p.toString()}`;
  };
  const push = (over: Parameters<typeof urlFor>[0]) => router.push(urlFor(over));

  const tab = (active: boolean) =>
    `rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
      active ? "bg-volt text-ink" : "border border-line-2 text-muted hover:text-fg"
    }`;
  const select =
    "rounded-lg border border-line-2 bg-ink px-3 py-1.5 font-mono text-xs text-fg outline-none focus:border-volt/50";

  return (
    <div className="space-y-3">
      {/* metric axis */}
      <div className="flex items-center gap-2">
        {METRICS.map((m) => (
          <button key={m.key} onClick={() => push({ metric: m.key })} className={tab(metric === m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      {/* lens axis */}
      <div className="flex flex-wrap items-center gap-2">
        {LENSES.map((l) => (
          <button key={l.key} onClick={() => push({ lens: l.key })} className={tab(lens === l.key)}>
            {l.label}
          </button>
        ))}

        {lens === "nation" && (
          <select value={nation} onChange={(e) => push({ nation: e.target.value })} className={select}>
            {nations.map((n) => (
              <option key={n.code} value={n.code}>
                {n.code} ({n.count})
              </option>
            ))}
          </select>
        )}

        {lens === "liga" && (
          <select value={league} onChange={(e) => push({ league: e.target.value })} className={select}>
            {leagues.map((l) => (
              <option key={l.key} value={l.key}>
                {leagueLabel(l.key)} ({l.count})
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
