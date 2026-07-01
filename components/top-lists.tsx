"use client";

import { useState } from "react";
import { teamLogoUrl } from "@/lib/team-logos";

export interface ListRow {
  n: string;
  t: string;
  lg: string;
  v: string;
  hint?: string;
}
export interface TopList {
  key: string;
  title: string;
  sub: string;
  rows: ListRow[];
}

const LEAGUE_ABBR = (lg: string) => lg.slice(0, 3);

export function TopLists({ lists }: { lists: TopList[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {lists.map((l) => (
        <Card key={l.key} list={l} />
      ))}
    </div>
  );
}

function Card({ list }: { list: TopList }) {
  return (
    <div className="rounded-xl border border-line bg-panel/30 p-3.5">
      <div className="mb-2 border-b border-line/60 pb-2">
        <div className="font-display text-sm font-bold text-fg">{list.title}</div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-faint">
          {list.sub}
        </div>
      </div>
      {list.rows.length === 0 ? (
        <div className="py-6 text-center font-mono text-xs text-faint">ingen data endnu</div>
      ) : (
        <ol className="space-y-0.5">
          {list.rows.map((r, i) => (
            <li
              key={`${r.n}-${r.t}-${i}`}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-panel/60"
            >
              <span className="tnum w-4 shrink-0 text-right font-mono text-[11px] text-faint">
                {i + 1}
              </span>
              <Crest team={r.t} />
              <span className="min-w-0 flex-1 truncate">
                <span className="text-fg">{r.n}</span>
                <span className="ml-1.5 font-mono text-[10px] text-faint">
                  {r.t} · {LEAGUE_ABBR(r.lg)}
                </span>
              </span>
              {r.hint && (
                <span className="shrink-0 font-mono text-[10px] text-muted">{r.hint}</span>
              )}
              <span className="tnum shrink-0 font-mono text-xs font-semibold text-volt">
                {r.v}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Crest({ team }: { team: string }) {
  const [ok, setOk] = useState(true);
  const url = teamLogoUrl(team);
  if (!url || !ok)
    return <span className="inline-block h-4 w-4 shrink-0" aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      onError={() => setOk(false)}
      loading="lazy"
      className="h-4 w-4 shrink-0 object-contain"
    />
  );
}
