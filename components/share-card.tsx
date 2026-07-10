"use client";

import { useRef, useState } from "react";
import { teamLogoUrl } from "@/lib/team-logos";
import type { PlayerDetail } from "@/lib/similar";

// Fixed branded palette (not theme-dependent) so every exported card looks the same.
const C = {
  ink: "#f4eee0",
  panel: "#efe8d8",
  line: "#cdc1a6",
  fg: "#201d17",
  muted: "#6e6655",
  faint: "#9a9078",
  volt: "#26221b",
};

function euro(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}m`;
  if (v >= 1_000) return `€${Math.round(v / 1_000)}k`;
  return `€${v}`;
}
const footDa = (f: string | null) =>
  f ? ({ Right: "Højre", Left: "Venstre", Both: "Begge" })[f] ?? f : null;

const topPhrase = (pct: number) =>
  pct >= 99.9 ? "flest i 30 ligaer" : `top ${Math.max(1, Math.round(100 - pct))}%`;
const fmtStat = (label: string, v: number) =>
  /%|pct|præcis|besidd/i.test(label) ? `${Math.round(v)}%` : `${v < 1 ? v.toFixed(2) : v.toFixed(1)}/90`;

export function ShareCard({ detail: d, caption }: { detail: PlayerDetail; caption: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const strengths = (
    d.groups.flatMap((g) => g.stats).filter((s) => s.value != null && s.pct != null) as {
      label: string;
      value: number;
      pct: number;
    }[]
  )
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);
  const totals = d.flat.filter((f) => f.value != null && !f.pct).slice(0, 3);
  const role = d.role?.primary?.role;
  const big5 = d.benchmarkSimilar[0];
  const logo = teamLogoUrl(d.team);
  const bio = [d.age != null ? `${d.age} år` : null, d.height != null ? `${d.height} cm` : null, footDa(d.foot)]
    .filter(Boolean)
    .join(" · ");

  async function download() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const { toPng } = await import("html-to-image");
      await document.fonts.ready;
      const url = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${d.player.replace(/\s+/g, "-")}-oto.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }
  function copy() {
    navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const label = (t: string) => (
    <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.faint, marginBottom: 8, fontFamily: "monospace" }}>
      {t}
    </div>
  );

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={download} disabled={busy}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: C.volt, color: C.ink, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}>
          {busy ? "Renderer…" : "⬇ Download PNG"}
        </button>
        <button onClick={copy}
          style={{ padding: "10px 14px", borderRadius: 10, background: "transparent", color: C.muted, fontSize: 13, border: `1px solid ${C.line}`, cursor: "pointer" }}>
          {copied ? "✓ Kopieret" : "⧉ Kopiér caption"}
        </button>
      </div>

      {/* ── THE CARD (exported as PNG) ── */}
      <div ref={cardRef}
        style={{ width: 520, background: C.ink, color: C.fg, borderRadius: 22, padding: 30, border: `1px solid ${C.line}`, boxSizing: "border-box" }}>
        {/* brand strip */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: 3, color: C.volt, fontWeight: 700 }}>OTO · SCOUT</div>
          <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 2, color: C.ink, background: C.volt, padding: "4px 10px", borderRadius: 999 }}>HIDDEN GEM</div>
        </div>

        {/* header: name + club + bio */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.05 }}>{d.player}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: C.muted, fontSize: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logo && <img src={logo} alt="" width={18} height={18} style={{ objectFit: "contain" }} />}
              <span>{d.team}</span>
              {d.nation && (
                <span style={{ fontFamily: "monospace", fontSize: 11, color: C.faint, border: `1px solid ${C.line}`, padding: "1px 5px", borderRadius: 4 }}>
                  {d.nation}
                </span>
              )}
            </div>
            <div style={{ marginTop: 6, color: C.faint, fontSize: 13, fontFamily: "monospace" }}>{bio}</div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ width: 76, height: 76, borderRadius: "50%", background: C.volt, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 800 }}>
              {d.out ?? "—"}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, letterSpacing: 2, color: C.faint, fontFamily: "monospace" }}>OUT</div>
            {role && <div style={{ marginTop: 2, fontSize: 12, color: C.muted, fontWeight: 600 }}>{role}</div>}
          </div>
        </div>

        {/* season totals — the relatable raw numbers */}
        {totals.length > 0 && (
          <div style={{ marginTop: 22, display: "flex", gap: 10 }}>
            {totals.map((t) => (
              <div key={t.label} style={{ flex: 1, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{t.value}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{t.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* strengths — raw per-90 value + plain-language rank (not a bare "100") */}
        <div style={{ marginTop: 22 }}>
          {label("Stærkest · pr. 90 min på tværs af 30 ligaer")}
          {strengths.map((s) => (
            <div key={s.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, gap: 10 }}>
                <span style={{ fontSize: 14, color: C.fg, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{s.label}</span>
                <span style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                  <span style={{ fontWeight: 700 }}>{fmtStat(s.label, s.value)}</span>
                  <span style={{ color: C.muted }}> · {topPhrase(s.pct)}</span>
                </span>
              </div>
              <div style={{ height: 6, background: C.line, borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${s.pct}%`, height: "100%", background: C.volt, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>

        {/* value + comp */}
        <div style={{ marginTop: 22, display: "flex", gap: 24 }}>
          {d.marketValue != null && (
            <div style={{ flex: 1 }}>
              {label("Værdi")}
              <div style={{ fontSize: 20, fontWeight: 800 }}>{euro(d.marketValue)}</div>
              {d.valueSpread && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>leverer som {euro(d.valueSpread.median)}-profiler</div>}
            </div>
          )}
          {big5 && (
            <div style={{ flex: 1 }}>
              {label("Ligner i big-5")}
              <div style={{ fontSize: 16, fontWeight: 700 }}>{big5.player}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{big5.team}</div>
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ marginTop: 26, paddingTop: 14, borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 10, color: C.faint }}>
          <span>{d.minutes} min · sæson 25/26</span>
          <span>genereret med OtoScout</span>
        </div>
      </div>

      {/* caption preview */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.faint, marginBottom: 8 }}>Caption</div>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, lineHeight: 1.5, color: C.fg, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, margin: 0 }}>
          {caption}
        </pre>
      </div>
    </div>
  );
}
