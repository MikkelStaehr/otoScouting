"use client";

// A native <select> can't render icons, so this is a small custom dropdown: a
// button showing the current option's icon + label, and a popover list (with an
// optional search when there are many options). Used for the league / nationality
// filters so each row carries a flag.

import { useEffect, useRef, useState } from "react";

export interface Opt {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export function IconSelect({
  value,
  onChange,
  options,
  label,
  minWidth = 150,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  label?: string;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];
  const searchable = options.length > 12;
  const ql = q.trim().toLowerCase();
  const shown = ql ? options.filter((o) => o.label.toLowerCase().includes(ql)) : options;

  return (
    <div className="relative inline-flex flex-col gap-1" ref={ref}>
      {label && <span className="font-mono text-[10px] uppercase tracking-wider text-faint">{label}</span>}
      <button
        onClick={() => { setOpen((o) => !o); setQ(""); }}
        style={{ minWidth }}
        className="flex items-center gap-2 rounded-lg border border-line-2 bg-ink px-3 py-1.5 font-mono text-xs text-fg outline-none transition-colors hover:border-volt/50"
      >
        {current?.icon}
        <span className="flex-1 truncate text-left">{current?.label}</span>
        <span className="shrink-0 text-faint">▾</span>
      </button>
      {open && (
        <div className="absolute top-full z-[70] mt-1 max-h-72 w-full overflow-hidden rounded-lg border border-line-2 bg-panel/98 shadow-2xl shadow-black/40" style={{ minWidth }}>
          {searchable && (
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søg…"
              className="w-full border-b border-line/60 bg-transparent px-3 py-2 text-xs text-fg outline-none placeholder:text-faint"
            />
          )}
          <div className="max-h-60 overflow-y-auto py-1">
            {shown.map((o) => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xs transition-colors hover:bg-ink/60 ${
                  o.value === value ? "text-volt" : "text-fg"
                }`}
              >
                {o.icon ?? <span className="inline-block h-2.5 w-3.5 shrink-0" />}
                <span className="flex-1 truncate">{o.label}</span>
                {o.value === value && <span className="shrink-0">✓</span>}
              </button>
            ))}
            {shown.length === 0 && <div className="px-3 py-2 font-mono text-[11px] text-faint">intet match</div>}
          </div>
        </div>
      )}
    </div>
  );
}
