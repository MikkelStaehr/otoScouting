"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RawColumn } from "@/lib/raw-data";
import { openPlayer } from "./player-modal";

export function RawDatabase({
  cols,
  rows,
  keys,
}: {
  cols: RawColumn[];
  rows: (string | number | null)[][];
  keys: string[];
}) {
  const [q, setQ] = useState("");
  const [sortIdx, setSortIdx] = useState(9); // OUT
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  // Window the render — 15k rows in the DOM was the /database bottleneck (~11s).
  const [renderLimit, setRenderLimit] = useState(200);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const rowsWithKey = useMemo(() => rows.map((r, i) => ({ r, key: keys[i]! })), [rows, keys]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const base = ql
      ? rowsWithKey.filter(({ r }) => String(r[0]).toLowerCase().includes(ql) || String(r[1]).toLowerCase().includes(ql))
      : rowsWithKey;
    const num = cols[sortIdx]?.num;
    return [...base].sort((a, b) => {
      const va = a.r[sortIdx];
      const vb = b.r[sortIdx];
      let cmp: number;
      if (num) cmp = (Number(va ?? -Infinity)) - (Number(vb ?? -Infinity));
      else cmp = String(va ?? "").localeCompare(String(vb ?? ""));
      return dir === "asc" ? cmp : -cmp;
    });
  }, [rowsWithKey, q, sortIdx, dir, cols]);

  // Reset to the top whenever the filtered/sorted set changes.
  useEffect(() => setRenderLimit(200), [filtered]);
  const shown = useMemo(() => filtered.slice(0, renderLimit), [filtered, renderLimit]);

  // Grow the window as a sentinel below the rows scrolls into the table container.
  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting)
          setRenderLimit((n) => (n < filtered.length ? n + 300 : n));
      },
      { root, rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const fmt = (v: string | number | null, num: boolean) => {
    if (v == null) return "—";
    if (num && typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
    return String(v);
  };

  function toggleSort(i: number) {
    if (sortIdx === i) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortIdx(i);
      setDir(cols[i]?.num ? "desc" : "asc");
    }
  }

  function exportCsv() {
    const esc = (v: string | number | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = cols.map((c) => esc(c.label)).join(",");
    const body = filtered.map(({ r }) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([`${head}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `otoscout-raw-${filtered.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Søg spiller/hold…"
          className="w-56 rounded-lg border border-line-2 bg-ink px-3 py-1.5 text-sm text-fg outline-none placeholder:text-faint focus:border-volt/50"
        />
        <span className="font-mono text-xs text-muted">
          <span className="tnum text-base font-bold text-fg">{filtered.length}</span> / {rows.length} rækker
        </span>
        <button
          onClick={exportCsv}
          className="ml-auto rounded-lg border border-line-2 px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-volt/50 hover:text-volt"
        >
          ↓ CSV ({filtered.length})
        </button>
      </div>

      <div ref={scrollRef} className="max-h-[76vh] overflow-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-ink-2">
            <tr className="border-b border-line">
              {cols.map((c, i) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(i)}
                  title={c.key}
                  className={`cursor-pointer select-none whitespace-nowrap px-2.5 py-2 font-mono text-[10px] font-medium uppercase tracking-wider hover:text-fg ${
                    c.num ? "text-right" : "text-left"
                  } ${sortIdx === i ? "text-volt" : "text-faint"} ${i === 0 ? "sticky left-0 bg-ink-2" : ""}`}
                >
                  {c.label}
                  {sortIdx === i && <span className="ml-1">{dir === "asc" ? "▲" : "▼"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(({ r, key }, ri) => (
              <tr key={ri} className="border-t border-line/50 transition-colors hover:bg-panel/50">
                {r.map((v, ci) => (
                  <td
                    key={ci}
                    className={`whitespace-nowrap px-2.5 py-1.5 ${cols[ci]!.num ? "text-right tnum text-fg" : "text-muted"} ${
                      ci === 0 ? "sticky left-0 bg-ink font-medium text-fg" : ""
                    }`}
                  >
                    {ci === 0 ? (
                      <button onClick={() => openPlayer(key)} className="text-left transition-colors hover:text-volt">
                        {fmt(v, false)}
                      </button>
                    ) : (
                      fmt(v, cols[ci]!.num)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {/* Windowing sentinel — grows the render as it scrolls near the bottom. */}
        <div ref={sentinelRef} aria-hidden className="h-px" />
        {shown.length < filtered.length && (
          <div className="border-t border-line/50 py-3 text-center font-mono text-[11px] text-faint">
            viser {shown.length} af {filtered.length} · scroll for flere
          </div>
        )}
      </div>
    </div>
  );
}
