"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { leagueLabel } from "@/lib/league-meta";

const METRICS = [
  { key: "season", label: "Sæson" },
  { key: "form", label: "Form" },
];
const POOLS = [
  { key: "all", label: "Alle ligaer" },
  { key: "scouting", label: "Kun scouting" },
];
const LENSES = [
  { key: "samlet", label: "Samlet" },
  { key: "u21", label: "U21" },
  { key: "bargain", label: "Bargain" },
  { key: "nation", label: "Nation" },
  { key: "liga", label: "Liga" },
];

interface Opt {
  value: string;
  label: string;
  count: number;
}

/** App-themed dropdown (the native <select> clashed with the cream theme).
 *  Searchable once the list is long, click-outside / Escape to close. */
function Combo({ value, options, onChange }: { value: string; options: Opt[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);
  const searchable = options.length > 12;
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line-2 bg-panel px-3 py-1.5 font-mono text-xs text-fg transition-colors hover:border-volt/50"
      >
        <span className="max-w-[160px] truncate">{current?.label ?? "Vælg"}</span>
        {current && <span className="text-faint">{current.count}</span>}
        <span className={`text-faint transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-line-2 bg-panel p-1 shadow-xl shadow-black/25">
          {searchable && (
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søg…"
              autoFocus
              className="mb-1 w-full rounded-lg border border-line-2 bg-ink px-2.5 py-1.5 font-mono text-xs text-fg outline-none placeholder:text-faint focus:border-volt/50"
            />
          )}
          <div className="max-h-72 overflow-y-auto">
            {shown.map((o) => {
              const sel = o.value === value;
              return (
                <button
                  key={o.value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQ("");
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-mono text-xs transition-colors ${
                    sel ? "bg-volt/10 text-volt" : "text-muted hover:bg-ink/60 hover:text-fg"
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {sel && <span className="text-[10px]">✓</span>}
                    {o.label}
                  </span>
                  <span className="text-faint">{o.count}</span>
                </button>
              );
            })}
            {shown.length === 0 && (
              <div className="px-2.5 py-3 text-center font-mono text-[11px] text-faint">ingen match</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function BestXIControls({
  metric,
  pool,
  lens,
  nation,
  league,
  nations,
  leagues,
}: {
  metric: string;
  pool: string;
  lens: string;
  nation: string;
  league: string;
  nations: { code: string; count: number }[];
  leagues: { key: string; count: number }[];
}) {
  const router = useRouter();

  // Build a URL from the current state with the given overrides — so switching one
  // axis (metric / pool / lens / dropdown) preserves the others.
  const urlFor = (over: Partial<{ metric: string; pool: string; lens: string; nation: string; league: string }>) => {
    const m = over.metric ?? metric;
    const pl = over.pool ?? pool;
    const l = over.lens ?? lens;
    const p = new URLSearchParams();
    if (m === "form") p.set("metric", "form");
    if (pl === "scouting") p.set("pool", "scouting");
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

  return (
    <div className="space-y-3">
      {/* metric + pool axes */}
      <div className="flex flex-wrap items-center gap-2">
        {METRICS.map((m) => (
          <button key={m.key} onClick={() => push({ metric: m.key })} className={tab(metric === m.key)}>
            {m.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line-2" />
        {POOLS.map((pl) => (
          <button key={pl.key} onClick={() => push({ pool: pl.key })} className={tab(pool === pl.key)}>
            {pl.label}
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
          <Combo
            value={nation}
            options={nations.map((n) => ({ value: n.code, label: n.code, count: n.count }))}
            onChange={(v) => push({ nation: v })}
          />
        )}

        {lens === "liga" && (
          <Combo
            value={league}
            options={leagues.map((l) => ({ value: l.key, label: leagueLabel(l.key), count: l.count }))}
            onChange={(v) => push({ league: v })}
          />
        )}
      </div>
    </div>
  );
}
