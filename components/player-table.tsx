"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { EnrichedPlayer, GroupKey, MetricKey } from "@/lib/types";
import { METRIC_LABEL, METRIC_NAME, METRIC_DESC, GROUP_LABEL } from "@/lib/metrics";
import { flagUrl, leagueFlagUrl } from "@/lib/flags";
import { teamLogoUrl } from "@/lib/team-logos";
import { medianStyle } from "@/lib/heat";
import { CompareOverlay } from "./compare-overlay";
import { openPlayer } from "./player-modal";
import { WatchlistButton } from "./watchlist";

export const FOCUS_EVENT = "otoscout:focus-player";

type Mode = "raw" | "per90" | "percentile";

// The table opens on an Overview tab (stamdata), then splits into stat tabs.
type View = "overview" | "offensive" | "defensive" | "goalkeeping";
const VIEW_ORDER: View[] = ["overview", "offensive", "defensive", "goalkeeping"];
const VIEW_GROUPS: Record<View, GroupKey[]> = {
  overview: [],
  offensive: ["offensive", "expected", "creation", "efficiency"],
  defensive: ["defensive", "buildup"],
  goalkeeping: ["goalkeeping"],
};
const VIEW_LABEL: Record<View, string> = {
  overview: "Oversigt",
  offensive: "Offensive",
  defensive: "Defensive",
  goalkeeping: "Goalkeeping",
};

const POSITIONS = ["GK", "DF", "MF", "FW"] as const;

interface FilterField {
  key: string;
  label: string; // full readable name
  abbr: string; // short code (for the compact filter card)
  kind: "raw" | "metric";
  group: string;
}
interface Bounds {
  min: number;
  max: number;
  step: number;
}

const LEAGUE_ABBR: Record<string, string> = {
  "DEN-Superliga": "DEN",
  "SWE-Allsvenskan": "SWE",
  "NOR-Eliteserien": "NOR",
};

/** Transfermarkt market value -> compact string (€350k, €1.2m, €12m). */
function fmtValue(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}m`;
  if (v >= 1_000) return `€${Math.round(v / 1_000)}k`;
  return `€${v}`;
}

export function PlayerTable({
  players,
  groups,
  rates,
  comparedTo,
  crossLeague = false,
}: {
  players: EnrichedPlayer[];
  groups: Record<GroupKey, MetricKey[]>;
  rates: MetricKey[];
  minMinutes?: number;
  comparedTo: string | null;
  crossLeague?: boolean;
}) {
  const rateSet = useMemo(() => new Set(rates), [rates]);

  const [mode, setMode] = useState<Mode>("per90");
  const [sortKey, setSortKey] = useState<string>("outputScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [view, setView] = useState<View>("overview");
  const [positions, setPositions] = useState<Set<string>>(() => new Set(POSITIONS));
  const [showDelta, setShowDelta] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, [number, number]>>({});
  const [filterModal, setFilterModal] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  // ── Filterable fields: age + minutes, plus every metric across all groups ──
  const metricGroup = useMemo(() => {
    const m = new Map<MetricKey, GroupKey>();
    for (const g of Object.keys(groups) as GroupKey[])
      for (const metric of groups[g]) m.set(metric, g);
    return m;
  }, [groups]);

  const FILTER_FIELDS = useMemo<FilterField[]>(() => {
    const metrics = [...new Set(Object.values(groups).flat())];
    return [
      { key: "minutes", label: "Minutter", abbr: "Min", kind: "raw", group: "Generelt" },
      { key: "age", label: "Alder", abbr: "Age", kind: "raw", group: "Generelt" },
      ...metrics.map((m) => ({
        key: m,
        label: METRIC_NAME[m],
        abbr: METRIC_LABEL[m],
        kind: "metric" as const,
        group: GROUP_LABEL[metricGroup.get(m)!],
      })),
    ];
  }, [groups, metricGroup]);

  function metricValue(p: EnrichedPlayer, m: MetricKey): number | null {
    if (mode === "raw")
      return (p as unknown as Record<string, number | null>)[m] ?? p.per90[m];
    if (mode === "per90") return p.per90[m];
    return p.percentile[m];
  }

  function fieldValue(p: EnrichedPlayer, key: string): number | null {
    if (key === "minutes") return p.minutes;
    if (key === "age") return p.age || null;
    return metricValue(p, key as MetricKey);
  }

  // Auto-derived min/max/step per field (mode-aware for metrics).
  const fieldBounds = useMemo(() => {
    const out: Record<string, Bounds> = {};
    for (const f of FILTER_FIELDS) {
      const vals = players
        .map((p) => fieldValue(p, f.key))
        .filter((v): v is number => v != null);
      if (!vals.length) {
        out[f.key] = { min: 0, max: 0, step: 1 };
        continue;
      }
      let lo = Math.min(...vals);
      let hi = Math.max(...vals);
      const allInt = vals.every((v) => Number.isInteger(v));
      let step = 1;
      if (f.key === "minutes") {
        step = 10;
        lo = Math.floor(lo / 10) * 10;
        hi = Math.ceil(hi / 10) * 10;
      } else if (allInt) {
        lo = Math.floor(lo);
        hi = Math.ceil(hi);
      } else {
        step = 0.05;
        lo = Math.floor(lo * 20) / 20;
        hi = Math.ceil(hi * 20) / 20;
      }
      out[f.key] = { min: lo, max: hi, step };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, mode, FILTER_FIELDS]);

  // Metric filter units change with display mode → reset them on mode change.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setFilterValues((prev) => {
      const next = { ...prev };
      for (const key of activeFilters) {
        const f = FILTER_FIELDS.find((x) => x.key === key);
        if (f?.kind === "metric") {
          const b = fieldBounds[key]!;
          next[key] = [b.min, b.max];
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function addFilter(key: string) {
    if (activeFilters.includes(key)) return;
    const b = fieldBounds[key]!;
    setActiveFilters((a) => [...a, key]);
    setFilterValues((v) => ({ ...v, [key]: [b.min, b.max] }));
  }
  function removeFilter(key: string) {
    setActiveFilters((a) => a.filter((k) => k !== key));
    setFilterValues((v) => {
      const n = { ...v };
      delete n[key];
      return n;
    });
  }
  function toggleFilter(key: string) {
    activeFilters.includes(key) ? removeFilter(key) : addFilter(key);
  }

  function matchesPosition(p: EnrichedPlayer): boolean {
    const tokens = (p.pos ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) return positions.size === POSITIONS.length;
    return tokens.some((t) => positions.has(t));
  }

  // Filter/sort/render off the deferred filter values so dragging a slider stays
  // responsive — React updates the (heavy) table at low priority, not per pixel.
  const dFilterValues = useDeferredValue(filterValues);
  const filtered = useMemo(() => {
    return players.filter((p) => {
      if (!matchesPosition(p)) return false;
      for (const key of activeFilters) {
        const [min, max] = dFilterValues[key] ?? [0, 0];
        const b = fieldBounds[key]!;
        const v = fieldValue(p, key);
        const narrowed = min > b.min || max < b.max;
        if (v == null) {
          if (narrowed) return false; // a narrowed filter excludes N/A values
        } else if (v < min || v > max) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, positions, activeFilters, dFilterValues, fieldBounds, mode]);

  // ── sorting ──
  function metricSort(p: EnrichedPlayer, key: string): number | string {
    if (key === "player" || key === "team" || key === "pos")
      return (p[key] ?? "") as string;
    if (key === "nation") return (p.nation ?? "") as string;
    if (key === "age") return p.age ?? 0;
    if (key === "minutes") return p.minutes;
    if (key === "outputScore") return p.outputScore ?? -Infinity;
    if (key === "market_value") return p.market_value ?? -Infinity;
    if (key === "gaPer90") return p.gaPer90;
    if (key === "mp") return p.mp;
    if (key === "nineties") return p.minutes / 90;
    if (key === "g_total") return p.goals;
    if (key === "a_total") return p.assists;
    if (key === "xg_total") return p.xg ?? -Infinity;
    if (key === "xa_total") return p.xa ?? -Infinity;
    if (key === "int_total") return p.interceptions;
    if (key === "tklw_total") return p.tackles_won;
    return metricValue(p, key as MetricKey) ?? -Infinity;
  }
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = metricSort(a, sortKey);
      const vb = metricSort(b, sortKey);
      const cmp =
        typeof va === "string"
          ? va.localeCompare(vb as string)
          : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, mode]);

  function toggleSort(key: string, isText = false) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(isText ? "asc" : "desc");
    }
  }
  function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
    const next = new Set(set);
    next.has(item) ? next.delete(item) : next.add(item);
    return next;
  }
  // Switching to the goalkeeping tab auto-filters to keepers only.
  function changeView(v: View) {
    setView(v);
    setPositions(v === "goalkeeping" ? new Set(["GK"]) : new Set(POSITIONS));
  }

  function reset() {
    setView("overview");
    setPositions(new Set(POSITIONS));
    setActiveFilters([]);
    setFilterValues({});
    setShowDelta(false);
    setMode("per90");
  }

  // ── compare ──
  const byKey = useMemo(
    () => new Map(players.map((p) => [`${p.team}::${p.player}`, p])),
    [players],
  );
  const selected = compareKeys
    .map((k) => byKey.get(k))
    .filter((p): p is EnrichedPlayer => Boolean(p));
  const compareMetrics = useMemo(() => {
    if (selected.length === 2 && selected.every((p) => p.gk_saves !== null))
      return groups.goalkeeping ?? [];
    return [...(groups.offensive ?? []), ...(groups.defensive ?? [])];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareKeys, groups]);
  function toggleCompare(key: string) {
    setCompareKeys((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key].slice(-2),
    );
  }

  // ⌘K palette → scroll to + highlight a player row.
  useEffect(() => {
    function onFocus(e: Event) {
      const key = (e as CustomEvent<{ key: string }>).detail?.key;
      if (!key) return;
      setFocusKey(key);
      requestAnimationFrame(() => {
        bodyRef.current
          ?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
    window.addEventListener(FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(FOCUS_EVENT, onFocus);
  }, []);

  const activeGroups = useMemo(
    () => VIEW_GROUPS[view].filter((g) => groups[g]?.length),
    [view, groups],
  );
  const columns = useMemo(
    () =>
      activeGroups.flatMap((g) =>
        groups[g].map((metric, i) => ({ group: g, metric, groupStart: i === 0 })),
      ),
    [activeGroups, groups],
  );
  const identityColSpan = 9; // Player, Nat, Team, Pos, Age, Min, OUT, Værdi, G+A/90

  return (
    <div className="space-y-4">
      {/* ── Control bar (above the table) ──────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented
          options={[
            ["raw", "raw"],
            ["per90", "/90"],
            ["percentile", "pct"],
          ]}
          value={mode}
          onChange={(m) => setMode(m as Mode)}
        />

        <div className="flex items-center gap-1">
          {POSITIONS.map((pos) => (
            <Chip
              key={pos}
              active={positions.has(pos)}
              onClick={() => setPositions((s) => toggleSetItem(s, pos))}
            >
              {pos}
            </Chip>
          ))}
        </div>

        {comparedTo && (
          <button
            onClick={() => setShowDelta((v) => !v)}
            title={`Δ siden ${comparedTo.replace("T", " ")} · xG/xA/GP`}
            className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
              showDelta
                ? "border-volt/60 bg-volt/10 text-volt"
                : "border-line-2 text-faint hover:text-muted"
            }`}
          >
            Δ form
          </button>
        )}

        <span
          className="flex items-center gap-1.5 font-mono text-[10px] text-faint"
          title="Cellefarve = over/under ligaens median (per-90 percentil vs pulje)"
        >
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "rgba(77,124,90,0.75)" }} />
          over
          <span className="ml-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "rgba(180,105,74,0.75)" }} />
          under median
        </span>

        <button
          onClick={() => setFilterModal(true)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-line-2 px-3 py-1 font-mono text-xs text-muted transition-colors hover:border-volt/60 hover:text-fg"
        >
          <span className="text-base leading-none text-volt">+</span> Filter
        </button>

        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-xs text-muted">
            <span className="tnum text-base font-bold text-fg">{filtered.length}</span>
            {" "}/ {players.length}
          </span>
          <button
            onClick={reset}
            className="font-mono text-[11px] text-faint transition-colors hover:text-volt"
          >
            reset
          </button>
        </div>
      </div>

      {/* Active filter cards */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {activeFilters.map((key) => {
            const f = FILTER_FIELDS.find((x) => x.key === key);
            return (
              <FilterCard
                key={key}
                label={f?.abbr ?? key}
                bounds={fieldBounds[key]!}
                value={filterValues[key] ?? [0, 0]}
                onChange={(val) => setFilterValues((v) => ({ ...v, [key]: val }))}
                onRemove={() => removeFilter(key)}
              />
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="inline-flex overflow-hidden rounded-lg border border-line-2">
        {VIEW_ORDER.map((v) => (
          <button
            key={v}
            onClick={() => changeView(v)}
            className={`px-4 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors sm:px-5 ${
              view === v ? "bg-volt text-ink" : "bg-panel/40 text-muted hover:text-fg"
            }`}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>

      {/* Overview table — stamdata left, key stats grouped right */}
      {view === "overview" && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-ink-2">
              <tr>
                <th colSpan={6} className="bg-ink-2 px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                  Stamdata
                </th>
                <th colSpan={3} className="border-l-2 border-line-2 px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                  Spilletid
                </th>
                <th colSpan={4} className="border-l-2 border-volt/30 px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-volt">
                  Offensive nøgletal
                </th>
                <th colSpan={2} className="border-l-2 border-volt/30 px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-volt">
                  Defensive nøgletal
                </th>
              </tr>
              <tr className="border-b border-line">
                <Th sticky title="Spiller" onClick={() => toggleSort("player", true)} active={sortKey === "player"} dir={sortDir}>Spiller</Th>
                <Th title="Nationalitet" onClick={() => toggleSort("nation", true)} active={sortKey === "nation"} dir={sortDir}>Nat</Th>
                <Th title="Hold" onClick={() => toggleSort("team", true)} active={sortKey === "team"} dir={sortDir}>Hold</Th>
                <Th title="Primær position" onClick={() => toggleSort("pos", true)} active={sortKey === "pos"} dir={sortDir}>Pos</Th>
                <Th num title="Alder" onClick={() => toggleSort("age")} active={sortKey === "age"} dir={sortDir}>Alder</Th>
                <Th num title="Markedsværdi (Transfermarkt)" onClick={() => toggleSort("market_value")} active={sortKey === "market_value"} dir={sortDir}>Værdi</Th>
                <Th num divider title="Kampe" onClick={() => toggleSort("mp")} active={sortKey === "mp"} dir={sortDir}>Kampe</Th>
                <Th num title="Spillede minutter" onClick={() => toggleSort("minutes")} active={sortKey === "minutes"} dir={sortDir}>Min</Th>
                <Th num title="90'ere (minutter / 90)" onClick={() => toggleSort("nineties")} active={sortKey === "nineties"} dir={sortDir}>90s</Th>
                <Th num divider title="Mål" onClick={() => toggleSort("g_total")} active={sortKey === "g_total"} dir={sortDir}>Mål</Th>
                <Th num title="Assists" onClick={() => toggleSort("a_total")} active={sortKey === "a_total"} dir={sortDir}>Assist</Th>
                <Th num title="Expected goals (Sofascore)" onClick={() => toggleSort("xg_total")} active={sortKey === "xg_total"} dir={sortDir}>xG</Th>
                <Th num title="Expected assists (Sofascore)" onClick={() => toggleSort("xa_total")} active={sortKey === "xa_total"} dir={sortDir}>xA</Th>
                <Th num divider title="Erobringer / interceptions" onClick={() => toggleSort("int_total")} active={sortKey === "int_total"} dir={sortDir}>Int</Th>
                <Th num title="Vundne tacklinger" onClick={() => toggleSort("tklw_total")} active={sortKey === "tklw_total"} dir={sortDir}>TklW</Th>
              </tr>
            </thead>
            <tbody ref={bodyRef}>
              {sorted.map((p, i) => {
                const key = `${p.team}::${p.player}`;
                const primaryPos = (p.pos ?? "").split(",")[0]?.trim() || "—";
                return (
                  <tr key={key} data-key={key} className={`border-t border-line/60 transition-colors ${focusKey === key ? "bg-volt/15" : "hover:bg-panel/50"} ${p.qualified ? "" : "opacity-45"}`}>
                    <td className="sticky left-0 z-[1] whitespace-nowrap bg-ink px-3 py-2 font-medium text-fg">
                      <button onClick={() => toggleCompare(key)} title="Add to comparison" aria-label="Add to comparison" className={`mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border align-middle text-[10px] leading-none transition-colors ${compareKeys.includes(key) ? "border-volt bg-volt text-ink" : "border-line-2 text-faint hover:border-volt/60"}`}>{compareKeys.includes(key) ? "✓" : "+"}</button>
                      <span className="mr-2 tnum text-[11px] text-faint">{i + 1}</span>
                      <button onClick={() => openPlayer(key)} className="text-left transition-colors hover:text-volt">{p.player}</button>
                    <span className="ml-2 align-middle"><WatchlistButton target={{ sid: p.sofascore_id, key, n: p.player, t: p.team, lg: p.league }} /></span>
                    </td>
                    <td className="px-3 py-2"><Flag nat={p.nation} /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{crossLeague && <LeagueTag league={p.league} />}<TeamLogo team={p.team} />{p.team}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">{primaryPos}</td>
                    <td className="px-3 py-2 text-right tnum text-muted">{p.age || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tnum text-muted">{fmtValue(p.market_value)}</td>
                    <td className="border-l-2 border-line-2 px-3 py-2 text-right tnum text-muted">{p.mp}</td>
                    <td className="px-3 py-2 text-right tnum text-muted">{p.minutes}</td>
                    <td className="px-3 py-2 text-right tnum text-muted">{(p.minutes / 90).toFixed(1)}</td>
                    <td className="border-l-2 border-line-2 px-3 py-2 text-right tnum font-medium text-fg" style={medianStyle(p.percentile.goals)}>{p.goals}</td>
                    <td className="px-3 py-2 text-right tnum text-fg" style={medianStyle(p.percentile.assists)}>{p.assists}</td>
                    <td className="px-3 py-2 text-right tnum text-fg" style={medianStyle(p.percentile.xg)}>{p.xg != null ? p.xg.toFixed(1) : "—"}</td>
                    <td className="px-3 py-2 text-right tnum text-fg" style={medianStyle(p.percentile.xa)}>{p.xa != null ? p.xa.toFixed(1) : "—"}</td>
                    <td className="border-l-2 border-line-2 px-3 py-2 text-right tnum text-fg" style={medianStyle(p.percentile.interceptions)}>{p.interceptions}</td>
                    <td className="px-3 py-2 text-right tnum text-fg" style={medianStyle(p.percentile.tackles_won)}>{p.tackles_won}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <p className="py-8 text-center font-mono text-sm text-muted">Ingen spillere matcher filtrene.</p>
          )}
        </div>
      )}

      {/* Stat table */}
      {view !== "overview" && (
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-ink-2">
            <tr>
              <th colSpan={identityColSpan} className="bg-ink-2" />
              {activeGroups.map((g) => (
                <th
                  key={g}
                  colSpan={groups[g].length}
                  className="border-l-2 border-volt/30 px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-volt"
                >
                  {GROUP_LABEL[g]}
                </th>
              ))}
            </tr>
            <tr className="border-b border-line">
              <Th sticky title="Spiller" onClick={() => toggleSort("player", true)} active={sortKey === "player"} dir={sortDir}>Player</Th>
              <Th title="Nationalitet" onClick={() => toggleSort("nation", true)} active={sortKey === "nation"} dir={sortDir}>Nat</Th>
              <Th title="Hold" onClick={() => toggleSort("team", true)} active={sortKey === "team"} dir={sortDir}>Team</Th>
              <Th title="Position" onClick={() => toggleSort("pos", true)} active={sortKey === "pos"} dir={sortDir}>Pos</Th>
              <Th num title="Alder" onClick={() => toggleSort("age")} active={sortKey === "age"} dir={sortDir}>Age</Th>
              <Th num title="Spillede minutter" onClick={() => toggleSort("minutes")} active={sortKey === "minutes"} dir={sortDir}>Min</Th>
              <Th num accent title="Output-score (0–100), rolle-relativ: markspillere på offensive+defensive percentiler, målmænd på goalkeeping." onClick={() => toggleSort("outputScore")} active={sortKey === "outputScore"} dir={sortDir}>OUT</Th>
              <Th num title="Markedsværdi (Transfermarkt)" onClick={() => toggleSort("market_value")} active={sortKey === "market_value"} dir={sortDir}>Værdi</Th>
              <Th num title="Mål + assists per 90 minutter" onClick={() => toggleSort("gaPer90")} active={sortKey === "gaPer90"} dir={sortDir}>G+A/90</Th>
              {columns.map(({ metric, groupStart }) => (
                <Th key={metric} num divider={groupStart} title={METRIC_DESC[metric]} onClick={() => toggleSort(metric)} active={sortKey === metric} dir={sortDir}>
                  {METRIC_LABEL[metric]}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {sorted.map((p, i) => {
              const key = `${p.team}::${p.player}`;
              const isFocus = focusKey === key;
              return (
                <tr
                  key={key}
                  data-key={key}
                  className={`border-t border-line/60 transition-colors ${
                    isFocus ? "bg-volt/15" : "hover:bg-panel/50"
                  } ${p.qualified ? "" : "opacity-45"}`}
                >
                  <td className="sticky left-0 z-[1] whitespace-nowrap bg-ink px-3 py-2 font-medium text-fg">
                    <button
                      onClick={() => toggleCompare(key)}
                      title="Add to comparison"
                      aria-label="Add to comparison"
                      className={`mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border align-middle text-[10px] leading-none transition-colors ${
                        compareKeys.includes(key)
                          ? "border-volt bg-volt text-ink"
                          : "border-line-2 text-faint hover:border-volt/60"
                      }`}
                    >
                      {compareKeys.includes(key) ? "✓" : "+"}
                    </button>
                    <span className="mr-2 tnum text-[11px] text-faint">{i + 1}</span>
                    <button onClick={() => openPlayer(key)} className="text-left transition-colors hover:text-volt">{p.player}</button>
                    <span className="ml-2 align-middle"><WatchlistButton target={{ sid: p.sofascore_id, key, n: p.player, t: p.team, lg: p.league }} /></span>
                  </td>
                  <td className="px-3 py-2"><Flag nat={p.nation} /></td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">
                    {crossLeague && <LeagueTag league={p.league} />}<TeamLogo team={p.team} />
                    {p.team}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">{p.pos ?? "—"}</td>
                  <td className="px-3 py-2 text-right tnum text-muted">{p.age || "—"}</td>
                  <td className="px-3 py-2 text-right tnum text-muted">{p.minutes}</td>
                  <td className="px-3 py-2 text-right tnum font-semibold text-volt">
                    {p.outputScore === null ? <span className="text-faint">—</span> : Math.round(p.outputScore)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tnum text-muted">{fmtValue(p.market_value)}</td>
                  <td className="px-3 py-2 text-right tnum text-fg">{p.gaPer90.toFixed(2)}</td>
                  {columns.map(({ metric, groupStart }) => (
                    <MetricCell
                      key={metric}
                      player={p}
                      metric={metric}
                      mode={mode}
                      isRate={rateSet.has(metric)}
                      divider={groupStart}
                      delta={showDelta ? p.delta?.[metric] ?? null : null}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p className="py-8 text-center font-mono text-sm text-muted">
            Ingen spillere matcher filtrene.
          </p>
        )}
      </div>
      )}

      {/* Compare tray */}
      {selected.length > 0 && (
        <div className="fixed bottom-5 left-1/2 z-40 flex max-w-[95vw] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border border-line-2 bg-panel/95 px-3 py-2 shadow-xl shadow-black/20 backdrop-blur">
          <span className="font-mono text-[11px] uppercase tracking-wider text-faint">compare</span>
          {selected.map((p) => {
            const k = `${p.team}::${p.player}`;
            return (
              <span key={k} className="flex items-center gap-1.5 rounded-full bg-ink-2 px-2.5 py-1 text-xs text-fg">
                {p.player}
                <button onClick={() => toggleCompare(k)} className="text-faint transition-colors hover:text-volt" aria-label={`Remove ${p.player}`}>×</button>
              </span>
            );
          })}
          {selected.length < 2 && <span className="font-mono text-[11px] text-faint">vælg en mere…</span>}
          <button
            disabled={selected.length < 2}
            onClick={() => setComparing(true)}
            className="rounded-full bg-volt px-3 py-1 text-xs font-semibold text-ink transition-opacity disabled:opacity-30"
          >
            Compare →
          </button>
          <button onClick={() => setCompareKeys([])} className="font-mono text-[11px] text-faint transition-colors hover:text-fg">clear</button>
        </div>
      )}

      {comparing && selected.length === 2 && (
        <CompareOverlay a={selected[0]!} b={selected[1]!} metrics={compareMetrics} rates={rates} onClose={() => setComparing(false)} />
      )}

      {filterModal && (
        <FilterModal
          fields={FILTER_FIELDS}
          active={activeFilters}
          onToggle={toggleFilter}
          onClose={() => setFilterModal(false)}
        />
      )}
    </div>
  );
}

/* ── small presentational pieces ─────────────────────────────────────── */

function Segmented({
  options,
  value,
  onChange,
}: {
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-line-2">
      {options.map(([val, label]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={`px-3 py-1 font-mono text-[11px] transition-colors ${
            value === val ? "bg-volt text-ink" : "bg-transparent text-muted hover:text-fg"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
        active
          ? "border-volt/50 bg-volt/15 text-volt"
          : "border-line-2 bg-transparent text-faint hover:text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function FilterCard({
  label,
  bounds,
  value,
  onChange,
  onRemove,
}: {
  label: string;
  bounds: Bounds;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  onRemove: () => void;
}) {
  const { min: bMin, max: bMax, step } = bounds;
  const [min, max] = value;
  const fmt = (v: number) => (step < 1 ? v.toFixed(2) : String(v));
  return (
    <div className="w-[210px] shrink-0 rounded-lg border border-line-2 bg-panel/50 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-fg">
          {label}
        </span>
        <button onClick={onRemove} aria-label="Fjern filter" className="text-faint transition-colors hover:text-fg">×</button>
      </div>
      <BoundRow tag="min" v={min} bMin={bMin} bMax={bMax} step={step} fmt={fmt} onChange={(nv) => onChange([Math.min(nv, max), max])} />
      <BoundRow tag="max" v={max} bMin={bMin} bMax={bMax} step={step} fmt={fmt} onChange={(nv) => onChange([min, Math.max(nv, min)])} />
    </div>
  );
}

function BoundRow({
  tag,
  v,
  bMin,
  bMax,
  step,
  fmt,
  onChange,
}: {
  tag: string;
  v: number;
  bMin: number;
  bMax: number;
  step: number;
  fmt: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 font-mono text-[10px] text-faint">{tag}</span>
      <input
        type="range"
        min={bMin}
        max={bMax}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-volt"
        aria-label={`${tag} slider`}
      />
      <input
        type="number"
        min={bMin}
        max={bMax}
        step={step}
        value={fmt(v)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-14 rounded border border-line-2 bg-ink px-1 py-0.5 text-right font-mono text-[11px] text-fg outline-none focus:border-volt/50"
        aria-label={`${tag} værdi`}
      />
    </div>
  );
}

function FilterModal({
  fields,
  active,
  onToggle,
  onClose,
}: {
  fields: FilterField[];
  active: string[];
  onToggle: (key: string) => void;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const groupsOf = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const map = new Map<string, FilterField[]>();
    for (const f of fields) {
      if (ql && !f.label.toLowerCase().includes(ql) && !f.key.toLowerCase().includes(ql)) continue;
      (map.get(f.group) ?? map.set(f.group, []).get(f.group)!).push(f);
    }
    return [...map.entries()];
  }, [fields, q]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Tilføj filtre" className="fixed inset-0 z-[55] flex items-start justify-center px-4 pt-[12vh]">
      <button aria-label="Luk" tabIndex={-1} onClick={onClose} className={`absolute inset-0 cursor-default bg-black/25 backdrop-blur-md transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`} />
      <div className={`relative flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line-2 bg-panel/95 shadow-2xl shadow-black/30 transition duration-200 ${visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.985] opacity-0"}`}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <span className="font-mono text-sm text-volt">+</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søg filtre…"
            className="w-full bg-transparent py-3.5 text-fg outline-none placeholder:text-faint"
          />
          <button onClick={onClose} className="font-mono text-[11px] text-muted hover:text-fg">esc</button>
        </div>
        <div className="overflow-y-auto p-2">
          {groupsOf.map(([group, fs]) => (
            <div key={group} className="mb-2">
              <div className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">{group}</div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {fs.map((f) => {
                  const on = active.includes(f.key);
                  return (
                    <button
                      key={f.key}
                      onClick={() => onToggle(f.key)}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        on ? "bg-volt/15 text-fg" : "text-muted hover:bg-panel"
                      }`}
                    >
                      <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border text-[9px] ${on ? "border-volt bg-volt text-ink" : "border-line-2"}`}>
                        {on ? "✓" : ""}
                      </span>
                      <span className="truncate">
                        {f.label}
                        {f.kind === "metric" && (
                          <span className="ml-1 text-faint">({f.abbr})</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {groupsOf.length === 0 && (
            <p className="px-3 py-8 text-center font-mono text-sm text-muted">Intet match.</p>
          )}
        </div>
        <div className="border-t border-line px-4 py-2 font-mono text-[11px] text-faint">
          {active.length} filtre aktive · vælg felter at filtrere på
        </div>
      </div>
    </div>
  );
}

function Flag({ nat }: { nat: string | null }) {
  const [ok, setOk] = useState(true);
  if (!nat) return <span className="text-faint">—</span>;
  const url = flagUrl(nat);
  if (!url || !ok)
    return <span className="font-mono text-[10px] text-faint">{nat}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={nat} title={nat} onError={() => setOk(false)} loading="lazy" className="inline-block h-3 w-auto rounded-[1px] ring-1 ring-line-2/60" />
  );
}

function LeagueTag({ league }: { league: string }) {
  const flag = leagueFlagUrl(league);
  return (
    <span
      title={league}
      className="mr-1.5 inline-flex items-center gap-1 rounded-[3px] border border-line-2 px-1 font-mono text-[9px] uppercase tracking-wider text-faint align-middle"
    >
      {flag && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flag} alt="" className="inline-block h-2 w-auto rounded-[1px]" />
      )}
      {LEAGUE_ABBR[league] ?? league.slice(0, 3)}
    </span>
  );
}

function TeamLogo({ team }: { team: string }) {
  const [ok, setOk] = useState(true);
  const url = teamLogoUrl(team);
  if (!url || !ok) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" onError={() => setOk(false)} loading="lazy" className="mr-2 inline-block h-4 w-4 object-contain align-middle" />
  );
}

function DeltaChip({ delta }: { delta: number }) {
  const flat = Math.abs(delta) < 0.05;
  const cls = flat ? "text-faint" : delta > 0 ? "text-emerald-700" : "text-red-700";
  return (
    <div className={`text-[9px] leading-none ${cls}`}>
      {flat ? "±0" : `${delta > 0 ? "▲" : "▼"}${Math.abs(delta).toFixed(1)}`}
    </div>
  );
}

function MetricCell({
  player,
  metric,
  mode,
  isRate,
  divider,
  delta,
}: {
  player: EnrichedPlayer;
  metric: MetricKey;
  mode: Mode;
  isRate: boolean;
  divider?: boolean;
  delta?: number | null;
}) {
  const div = divider ? "border-l-2 border-line-2" : "";
  const chip = delta != null ? <DeltaChip delta={delta} /> : null;
  const pct = player.percentile[metric];
  const tint = medianStyle(pct); // always-on over/under-median colouring

  if (mode === "percentile") {
    if (pct === null)
      return <td className={`px-3 py-2 text-right tnum text-faint ${div}`}>—</td>;
    return (
      <td className={`px-3 py-2 text-right tnum text-fg ${div}`} style={tint}>
        {Math.round(pct)}
        {chip}
      </td>
    );
  }

  const v = isRate
    ? player.per90[metric]
    : mode === "raw"
      ? ((player as unknown as Record<string, number | null>)[metric] ?? null)
      : player.per90[metric];
  if (v === null || v === undefined)
    return <td className={`px-3 py-2 text-right tnum text-faint ${div}`}>—</td>;
  const text = isRate ? v.toFixed(1) : mode === "raw" ? String(v) : v.toFixed(2);
  return (
    <td className={`px-3 py-2 text-right tnum text-fg ${div}`} style={tint}>
      {text}
      {chip}
    </td>
  );
}

function Th({
  children,
  num,
  accent,
  sticky,
  active,
  dir,
  onClick,
  title,
  divider,
}: {
  children: React.ReactNode;
  num?: boolean;
  accent?: boolean;
  sticky?: boolean;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
  title?: string;
  divider?: boolean;
}) {
  return (
    <th
      onClick={onClick}
      title={title}
      className={`px-3 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wider ${
        onClick ? "cursor-pointer select-none hover:text-fg" : ""
      } ${num ? "text-right" : "text-left"} ${
        accent ? "text-volt" : active ? "text-fg" : "text-muted"
      } ${sticky ? "sticky left-0 z-[1] bg-ink-2" : ""} ${
        divider ? "border-l-2 border-line-2" : ""
      }`}
    >
      {children}
      {active && <span className="ml-1 text-volt">{dir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );
}
