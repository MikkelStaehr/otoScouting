"use client";

import { useState } from "react";
import { teamLogoUrl } from "@/lib/team-logos";
import { leagueLabel } from "@/lib/league-meta";
import type { TeamReport, TeamReportInsights, TeamMetricReport } from "@/lib/team-report";

function Crest({ team, size = 34 }: { team: string; size?: number }) {
  const [ok, setOk] = useState(true);
  const url = teamLogoUrl(team);
  if (!url || !ok) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt=""
      onError={() => setOk(false)}
      style={{ height: size, width: size }}
      className="object-contain"
    />
  );
}

function fmtMetric(m: TeamMetricReport | undefined): string {
  if (!m || m.value == null) return "—";
  return m.rate ? `${m.value.toFixed(1)}%` : m.value.toFixed(2);
}

function ord(n: number): string {
  return `${n}.`;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line-2 bg-panel/50 px-3 py-2.5 text-center">
      <div className="tnum font-display text-xl font-bold text-fg">{value}</div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div>
      {sub && <div className="font-mono text-[9px] text-faint">{sub}</div>}
    </div>
  );
}

function Bars({ title, items, tone }: { title: string; items: TeamMetricReport[]; tone: "good" | "bad" }) {
  return (
    <div>
      <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-faint">{title}</div>
      <div className="space-y-1.5">
        {items.map((m) => (
          <div key={m.key} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-[11px] text-muted">{m.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-2">
              <div
                className={`h-full rounded-full ${tone === "good" ? "bg-volt" : "bg-red-400/80"}`}
                style={{ width: `${Math.round(m.pct ?? 0)}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-[10px] text-faint">
              {m.rank != null ? `${ord(m.rank)}/${m.of}` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StyleCard({ label, style }: { label: string; style: { style: string; conf: number; why: string[] } | null }) {
  if (!style) return null;
  return (
    <div className="rounded-xl border border-line bg-panel/30 p-3">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-faint">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-base font-bold text-fg">{style.style}</span>
        <span className="tnum font-mono text-[11px] text-volt">{style.conf}%</span>
      </div>
      {style.why.length > 0 && (
        <div className="mt-1 font-mono text-[10px] leading-relaxed text-faint">{style.why.join(" · ")}</div>
      )}
    </div>
  );
}

export function TeamReportView({ report: r, insights }: { report: TeamReport; insights: TeamReportInsights }) {
  const byKey = new Map(r.metrics.map((m) => [m.key, m]));
  const kpi = (k: string) => byKey.get(k);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 print:py-2">
      {/* toolbar — hidden on print */}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <a href="/hold" className="font-mono text-xs text-muted hover:text-fg">
          ← hold
        </a>
        <button
          onClick={() => window.print()}
          className="rounded-md border border-line-2 px-3 py-1 font-mono text-[11px] text-muted transition-colors hover:border-volt/60 hover:text-volt"
        >
          Print / PDF
        </button>
      </div>

      {/* header */}
      <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <Crest team={r.team} />
          <div>
            <h1 className="font-display text-2xl font-bold text-fg">{r.team}</h1>
            <div className="mt-0.5 font-mono text-[11px] text-muted">
              {leagueLabel(r.league)} · {r.season_label}
              {r.matches != null && ` · ${r.matches} kampe`}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="tnum font-display text-3xl font-bold text-volt">
            {r.rating != null ? r.rating.toFixed(2) : "—"}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
            rating{r.ratingRank != null && ` · ${ord(r.ratingRank)} af ${r.teamsInLeague}`}
          </div>
        </div>
      </div>

      {/* narrative */}
      <p className="mt-4 text-[13px] leading-relaxed text-fg">{insights.narrative}</p>

      {/* KPI row */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Kpi label="Mål /kamp" value={fmtMetric(kpi("goals"))} />
        <Kpi label="xG /kamp" value={fmtMetric(kpi("xg"))} />
        <Kpi label="Imod /kamp" value={fmtMetric(kpi("goals_conceded"))} />
        <Kpi label="St. ch. imod" value={fmtMetric(kpi("big_chances_against"))} />
        <Kpi label="Clean sheets" value={fmtMetric(kpi("clean_sheets"))} />
      </div>

      {/* playing style */}
      {r.style && (r.style.ip.primary || r.style.oop.primary) && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <StyleCard label="Med bolden" style={r.style.ip.primary} />
          <StyleCard label="Uden bolden" style={r.style.oop.primary} />
        </div>
      )}

      {/* strengths / weaknesses */}
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {r.strengths.length > 0 && <Bars title="Stærkest" items={r.strengths.slice(0, 5)} tone="good" />}
        {r.weaknesses.length > 0 && <Bars title="Svagest" items={r.weaknesses.slice(0, 5)} tone="bad" />}
      </div>

      {/* recruitment — the team-scouting payload */}
      {r.roleUpgrades.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">
            Rekruttering — svagest dækkede roller
          </div>
          <div className="space-y-2.5">
            {r.roleUpgrades.slice(0, 3).map((u) => (
              <div key={u.role} className="rounded-xl border border-line-2 bg-panel/40 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-fg">{u.role}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-clay">{u.reason}</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-muted">
                  nu: {u.currentPlayer ?? "—"}
                  {u.currentOut != null && ` (OUT ${Math.round(u.currentOut)})`}
                </div>
                {u.candidates.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {u.candidates.slice(0, 4).map((c) => (
                      <span
                        key={c.key}
                        className="rounded-full border border-line-2 px-2 py-0.5 font-mono text-[10px] text-fg"
                      >
                        {c.player}
                        <span className="text-faint"> · {leagueLabel(c.league)}</span>
                        {c.out != null && <span className="text-volt"> · {Math.round(c.out)}</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
