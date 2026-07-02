"use client";

// Watch-list client store (module-level, shared across all mounts) + the ⭐ button
// used in shortlist rows, the player modal, etc. One fetch on first use; mutations
// POST and broadcast the fresh list set to every subscriber.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface WatchEntry {
  sid: number | null;
  key: string;
  n: string;
  t: string;
  lg: string;
  note?: string;
  added: string;
}
export interface Watchlist {
  id: string;
  name: string;
  created: string;
  players: WatchEntry[];
}

let lists: Watchlist[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function ensureLoaded() {
  if (loaded || loading) return;
  loading = fetch("/api/watchlists")
    .then((r) => r.json())
    .then((d) => {
      lists = d.lists ?? [];
      loaded = true;
      emit();
    })
    .catch(() => {
      loaded = true;
    });
}

async function mutate(op: unknown): Promise<void> {
  try {
    const r = await fetch("/api/watchlists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(op),
    });
    const d = await r.json();
    if (d.lists) {
      lists = d.lists;
      loaded = true;
      emit();
    }
  } catch {
    /* ignore */
  }
}

export const watchlists = {
  create: (name: string) => mutate({ op: "create", name }),
  rename: (id: string, name: string) => mutate({ op: "rename", id, name }),
  remove: (id: string) => mutate({ op: "delete", id }),
  addPlayer: (id: string, entry: WatchEntry) => mutate({ op: "add", id, entry }),
  removePlayer: (id: string, sid: number | null, key: string) =>
    mutate({ op: "remove", id, sid, key }),
};

/** Subscribe a component to the shared watch-list state. */
export function useWatchlists(): Watchlist[] {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    subs.add(f);
    ensureLoaded();
    return () => {
      subs.delete(f);
    };
  }, []);
  return lists;
}

const inList = (l: Watchlist, sid: number | null, key: string) =>
  l.players.some((e) => (sid != null ? e.sid === sid : e.key === key));

export interface WatchTarget {
  sid: number | null;
  key: string;
  n: string;
  t: string;
  lg: string;
}

/** ⭐ toggle — opens a popover to add/remove the player across lists + create new. */
export function WatchlistButton({ target, size = "sm" }: { target: WatchTarget; size?: "sm" | "md" }) {
  const all = useWatchlists();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [newName, setNewName] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Portal + fixed positioning so the popover is never clipped by a table's
  // overflow-x container. Recomputed from the button rect on open.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      // Prefer opening rightward from the star (sits over content, stays legible);
      // clamp so it never runs off-screen. Flip up if it'd overflow the bottom.
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 232));
      const top = r.bottom + 6 + 240 > window.innerHeight ? r.top - 6 - 240 : r.bottom + 6;
      setPos({ top: Math.max(8, top), left });
    };
    place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const saved = all.some((l) => inList(l, target.sid, target.key));
  const star = size === "md" ? "text-lg" : "text-sm";

  const toggle = (l: Watchlist) => {
    if (inList(l, target.sid, target.key)) {
      watchlists.removePlayer(l.id, target.sid, target.key);
    } else {
      watchlists.addPlayer(l.id, {
        sid: target.sid,
        key: target.key,
        n: target.n,
        t: target.t,
        lg: target.lg,
        added: "",
      });
    }
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    await watchlists.create(name);
    // newest list is last; add the player to it
    const created = lists[lists.length - 1];
    if (created) await watchlists.addPlayer(created.id, {
      sid: target.sid, key: target.key, n: target.n, t: target.t, lg: target.lg, added: "",
    });
    setNewName("");
  };

  return (
    <span className="inline-flex">
      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        title={saved ? "På en watchlist" : "Tilføj til watchlist"}
        className={`leading-none transition-colors ${star} ${
          saved ? "text-volt" : "text-faint hover:text-volt"
        }`}
      >
        {saved ? "★" : "☆"}
      </button>
      {open && pos && createPortal(
        <div
          ref={popRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 224 }}
          className="z-[90] rounded-xl border border-line-2 bg-panel/98 p-2 shadow-2xl shadow-black/50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 px-1 font-mono text-[10px] uppercase tracking-wider text-faint">
            Watchlists
          </div>
          {all.length === 0 && (
            <div className="px-1 py-1 font-mono text-[11px] text-faint">ingen lister endnu</div>
          )}
          <div className="max-h-52 overflow-y-auto">
            {all.map((l) => {
              const on = inList(l, target.sid, target.key);
              return (
                <button
                  key={l.id}
                  onClick={() => toggle(l)}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-ink/50"
                >
                  <span className={`w-4 shrink-0 text-center ${on ? "text-volt" : "text-faint"}`}>
                    {on ? "★" : "☆"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-fg">{l.name}</span>
                  <span className="tnum shrink-0 font-mono text-[10px] text-faint">{l.players.length}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex items-center gap-1 border-t border-line/60 pt-1.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
              placeholder="Ny liste…"
              className="min-w-0 flex-1 rounded-md border border-line-2 bg-ink px-2 py-1 text-xs text-fg outline-none placeholder:text-faint focus:border-volt/50"
            />
            <button
              onClick={createAndAdd}
              className="shrink-0 rounded-md border border-line-2 px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:text-volt"
            >
              +
            </button>
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
