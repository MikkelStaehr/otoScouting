"use client";

import { useRouter } from "next/navigation";
import { leagueLabel } from "@/lib/league-meta";

const LENSES = [
  { key: "samlet", label: "Samlet" },
  { key: "u21", label: "U21" },
  { key: "bargain", label: "Bargain" },
  { key: "nation", label: "Nation" },
  { key: "liga", label: "Liga" },
];

export function BestXIControls({
  lens,
  nation,
  league,
  nations,
  leagues,
}: {
  lens: string;
  nation: string;
  league: string;
  nations: { code: string; count: number }[];
  leagues: { key: string; count: number }[];
}) {
  const router = useRouter();

  const go = (params: Record<string, string>) => {
    const q = new URLSearchParams(params);
    router.push(`/bedste-xi?${q.toString()}`);
  };
  const setLens = (k: string) => {
    if (k === "nation") go({ lens: "nation", nation: nation || nations[0]?.code || "" });
    else if (k === "liga") go({ lens: "liga", league: league || leagues[0]?.key || "" });
    else go({ lens: k });
  };

  const tab = (active: boolean) =>
    `rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
      active ? "bg-volt text-ink" : "border border-line-2 text-muted hover:text-fg"
    }`;
  const select =
    "rounded-lg border border-line-2 bg-ink px-3 py-1.5 font-mono text-xs text-fg outline-none focus:border-volt/50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {LENSES.map((l) => (
        <button key={l.key} onClick={() => setLens(l.key)} className={tab(lens === l.key)}>
          {l.label}
        </button>
      ))}

      {lens === "nation" && (
        <select
          value={nation}
          onChange={(e) => go({ lens: "nation", nation: e.target.value })}
          className={select}
        >
          {nations.map((n) => (
            <option key={n.code} value={n.code}>
              {n.code} ({n.count})
            </option>
          ))}
        </select>
      )}

      {lens === "liga" && (
        <select
          value={league}
          onChange={(e) => go({ lens: "liga", league: e.target.value })}
          className={select}
        >
          {leagues.map((l) => (
            <option key={l.key} value={l.key}>
              {leagueLabel(l.key)} ({l.count})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
