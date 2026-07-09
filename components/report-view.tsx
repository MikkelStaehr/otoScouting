"use client";

// One-page scouting report for a player — everything the tool knows, laid out for
// screen and print (browser print-to-PDF). Client component so it can trigger
// window.print(); interfaces are local copies (client-safe, like player-modal).

import { flagUrl } from "@/lib/flags";
import { teamLogoUrl } from "@/lib/team-logos";
import { leagueLabel } from "@/lib/league-meta";
import { PitchHeatmap } from "./pitch-heatmap";

interface SimStat { key: string; label: string; value: number | null; pct: number | null }
interface SimGroup { label: string; stats: SimStat[] }
interface SimilarPlayer { key: string; player: string; team: string; league: string; age: number | null; pos: string | null; sim: number }
interface ValueSpread {
  value: number | null; p25: number; median: number; p75: number; peerCount: number;
  topPeers: { key: string; player: string; team: string; league: string; value: number; sim: number }[];
}
interface RoleFit { role: string; conf: number; why: string[] }
interface RoleResult { bucket: string; primary: RoleFit | null; secondary: RoleFit | null }
interface HeatmapData { w: number; h: number; grid: number[]; nPoints: number; matches: number | null }
interface PlayerDetail {
  key: string; sid: number | null; player: string; team: string; league: string;
  age: number | null; pos: string | null; posGroup: string;
  nation: string | null; height: number | null; foot: string | null;
  minutes: number; out: number | null; marketValue: number | null;
  flat: { label: string; value: number | null; pct?: boolean }[];
  seasonTeams: string[] | null; role: RoleResult | null; heatmap: HeatmapData | null;
  groups: SimGroup[]; similar: SimilarPlayer[]; benchmarkSimilar: SimilarPlayer[]; valueSpread: ValueSpread | null;
}
interface ReportInsights { strengths: { label: string; pct: number }[]; weaknesses: { label: string; pct: number }[]; narrative: string }

function fmtValue(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}m`;
  if (v >= 1_000) return `€${Math.round(v / 1_000)}k`;
  return `€${v}`;
}

const footDa = (f: string): string =>
  ({ Right: "Højre fod", Left: "Venstre fod", Both: "Begge fødder" })[f] ?? f;

export function ReportView({ detail: d, insights }: { detail: PlayerDetail; insights: ReportInsights }) {
  const primaryPos = d.pos?.split(",")[0]?.trim();
  const pctStats = d.groups.flatMap((g) => g.stats).filter((s) => s.pct != null);
  return (
    <div className="mx-auto max-w-4xl p-6 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <a href="/board" className="font-mono text-xs text-muted transition-colors hover:text-fg">← tilbage</a>
        <button
          onClick={() => window.print()}
          className="rounded-lg border border-volt bg-volt/10 px-3 py-1.5 font-mono text-xs font-semibold text-volt transition-colors hover:bg-volt/20"
        >
          Print / PDF
        </button>
      </div>

      <div className="rounded-2xl border border-line bg-panel/20 p-6 print:rounded-none print:border-0 print:bg-transparent">
        {/* header */}
        <div className="flex items-start gap-4 border-b border-line pb-4">
          <TeamLogo team={d.team} size={44} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold text-fg">{d.player}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
              <span>{d.team}</span>
              <span className="text-faint">·</span>
              <span>{leagueLabel(d.league)}</span>
              {primaryPos && <span className="rounded border border-line-2 px-1 text-faint">{primaryPos}</span>}
              {d.age != null && <span>{d.age} år</span>}
              <Flag nat={d.nation} />
              {d.height != null && <span className="text-faint">· {d.height} cm</span>}
              {d.foot && <span className="text-faint">· {footDa(d.foot)}</span>}
              <span className="text-faint">· {d.minutes} min</span>
            </div>
            {d.role?.primary && (
              <div className="mt-1.5 font-mono text-xs text-volt">
                {d.role.primary.role} <span className="text-faint">({d.role.primary.conf}%)</span>
                {d.role.secondary && <span className="ml-2 text-faint">/ {d.role.secondary.role}</span>}
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-faint">OUT</div>
            <div className="tnum text-3xl font-bold text-volt">{d.out ?? "—"}</div>
          </div>
        </div>

        {/* narrative */}
        <p className="mt-4 text-sm leading-relaxed text-fg">{insights.narrative}</p>

        {/* value spread */}
        {d.valueSpread && (
          <div className="mt-4 rounded-xl border border-line bg-ink/40 p-4">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
                Værdi-spænd · {d.valueSpread.peerCount} ligemænd (profil + alder)
              </span>
              <span className="text-sm">
                <span className="text-faint">performer som </span>
                <span className="font-semibold text-volt">{fmtValue(d.valueSpread.median)}</span>
                <span className="text-faint">-profiler</span>
              </span>
            </div>
            <ValueBar vs={d.valueSpread} />
          </div>
        )}

        {/* strengths/weaknesses + heatmap */}
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-3">
            <SW title="Styrker" items={insights.strengths} tone="volt" />
            <SW title="Svagheder" items={insights.weaknesses} tone="clay" />
          </div>
          {d.heatmap && (
            <div>
              <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-faint">Positionering</div>
              <PitchHeatmap hm={d.heatmap} id={`rep-${d.sid ?? "x"}`} />
            </div>
          )}
        </div>

        {/* percentile profile */}
        {pctStats.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">Percentil-profil</div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              {pctStats.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="w-36 shrink-0 truncate font-mono text-[11px] text-muted">{s.label}</span>
                  <div className="relative h-1.5 flex-1 rounded-full bg-ink">
                    <div className="absolute h-1.5 rounded-full bg-volt/60" style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="tnum w-6 text-right font-mono text-[10px] text-faint">{s.pct}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* plays like */}
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Likes title="Ligner statistisk" items={d.similar.slice(0, 5)} />
          <Likes title="Ligner i big-5" items={d.benchmarkSimilar} />
        </div>

        <div className="mt-5 border-t border-line pt-3 font-mono text-[10px] text-faint">
          OtoScout · rå tal FBref, xG/spatial Sofascore, værdi Transfermarkt · percentiler ligastyrke-justeret
        </div>
      </div>
    </div>
  );
}

function SW({ title, items, tone }: { title: string; items: { label: string; pct: number }[]; tone: "volt" | "clay" }) {
  return (
    <div>
      <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-faint">{title}</div>
      {items.length === 0 ? (
        <div className="font-mono text-xs text-faint">—</div>
      ) : (
        <div className="space-y-1">
          {items.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-fg">{s.label}</span>
              <span className={`tnum font-mono text-xs font-semibold ${tone === "volt" ? "text-volt" : "text-clay"}`}>{s.pct}p</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Likes({ title, items }: { title: string; items: SimilarPlayer[] }) {
  return (
    <div>
      <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-faint">{title}</div>
      {items.length === 0 ? (
        <div className="font-mono text-xs text-faint">ingen tæt profil</div>
      ) : (
        <div className="space-y-1">
          {items.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-sm">
              <TeamLogo team={s.team} size={16} />
              <span className="min-w-0 flex-1 truncate text-fg">
                {s.player}
                <span className="ml-1.5 font-mono text-[10px] text-faint">{leagueLabel(s.league)}{s.age != null && ` · ${s.age}`}</span>
              </span>
              <span className="tnum shrink-0 font-mono text-xs font-semibold text-volt">{s.sim}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ValueBar({ vs }: { vs: ValueSpread }) {
  const val = vs.value;
  const lo = Math.min(vs.p25, val ?? vs.p25) * 0.85;
  const hi = Math.max(vs.p75, val ?? vs.p75) * 1.12;
  const pos = (x: number) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
  const under = val != null && val < vs.median;
  const premium = val != null && val > vs.p75;
  return (
    <div>
      <div className="relative h-2 rounded-full bg-ink">
        <div className="absolute top-0 h-2 rounded-full bg-volt/25" style={{ left: `${pos(vs.p25)}%`, width: `${Math.max(0, pos(vs.p75) - pos(vs.p25))}%` }} />
        <div className="absolute top-[-2px] h-3 w-px bg-fg" style={{ left: `${pos(vs.median)}%` }} />
        {val != null && (
          <div
            className={`absolute top-[-3px] h-4 w-4 -translate-x-1/2 rounded-full border-2 border-ink ${premium ? "bg-clay" : under ? "bg-volt" : "bg-fg"}`}
            style={{ left: `${pos(val)}%` }}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-faint">
        <span>{fmtValue(vs.p25)}</span>
        <span>median {fmtValue(vs.median)}</span>
        <span>{fmtValue(vs.p75)}</span>
      </div>
      {val != null && (
        <div className={`mt-1.5 font-mono text-[11px] ${premium ? "text-clay" : under ? "text-volt" : "text-muted"}`}>
          TM {fmtValue(val)} — {premium ? "over ligemænd · markeds-præmie (hype/platform)" : under ? "under medianen · potentiel upside" : "på linje med ligemænd"}
        </div>
      )}
    </div>
  );
}

function TeamLogo({ team, size = 20 }: { team: string; size?: number }) {
  const url = teamLogoUrl(team);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" width={size} height={size} className="inline-block shrink-0 object-contain" style={{ width: size, height: size }} />;
}

function Flag({ nat }: { nat: string | null }) {
  const url = nat ? flagUrl(nat) : null;
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={nat ?? ""} className="inline-block h-3 w-4 rounded-sm object-cover align-middle" />;
}
