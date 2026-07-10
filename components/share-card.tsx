"use client";

import { useRef, useState } from "react";
import { teamLogoUrl } from "@/lib/team-logos";
import type { PlayerDetail } from "@/lib/similar";

// Fixed branded palette (not theme-dependent) so every exported slide looks the same.
const C = {
  ink: "#f4eee0",
  panel: "#efe8d8",
  line: "#cdc1a6",
  fg: "#201d17",
  muted: "#6e6655",
  faint: "#9a9078",
  volt: "#26221b",
};
const W = 540;
const H = 675; // 4:5 — Instagram-friendly, same aspect on every slide

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

const secLabel = (t: string) => (
  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.faint, marginBottom: 10, fontFamily: "monospace" }}>
    {t}
  </div>
);

export function ShareSlides({ detail: d, caption }: { detail: PlayerDetail; caption: string }) {
  const refs = useRef<Array<HTMLDivElement | null>>([]);
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
    .slice(0, 6);
  const totals = d.flat.filter((f) => f.value != null && !f.pct).slice(0, 3);
  const logo = teamLogoUrl(d.team);
  const big5 = d.benchmarkSimilar[0];
  const peers = (d.valueSpread?.topPeers ?? []).slice(0, 3);
  const bio = [d.age != null ? `${d.age} år` : null, d.height != null ? `${d.height} cm` : null, footDa(d.foot)]
    .filter(Boolean)
    .join(" · ");
  const role = d.role?.primary?.role;

  async function toPngNode(node: HTMLDivElement): Promise<string> {
    const { toPng } = await import("html-to-image");
    await document.fonts.ready;
    return toPng(node, { pixelRatio: 2, cacheBust: true });
  }
  function dl(url: string, name: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  }
  const slug = d.player.replace(/\s+/g, "-");
  async function downloadOne(i: number) {
    const n = refs.current[i];
    if (!n) return;
    dl(await toPngNode(n), `${slug}-${i + 1}.png`);
  }
  async function downloadAll() {
    setBusy(true);
    try {
      for (let i = 0; i < refs.current.length; i++) {
        const n = refs.current[i];
        if (!n) continue;
        dl(await toPngNode(n), `${slug}-${i + 1}.png`);
        await new Promise((r) => setTimeout(r, 450)); // let each download commit
      }
    } finally {
      setBusy(false);
    }
  }
  function copy() {
    navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Consistent identity band on every slide, so each image stands alone in a carousel.
  const Ident = ({ section }: { section: string }) => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: 3, color: C.volt, fontWeight: 700 }}>OTO · SCOUT</div>
        <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 2, color: C.ink, background: C.volt, padding: "4px 10px", borderRadius: 999 }}>
          {section}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.05 }}>{d.player}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6, color: C.muted, fontSize: 13 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={logo} alt="" width={16} height={16} style={{ objectFit: "contain" }} />}
            <span>{d.team}</span>
            {d.nation && <span style={{ color: C.faint }}>· {d.nation}</span>}
          </div>
        </div>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: C.volt, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 }}>
            {d.out ?? "—"}
          </div>
          <div style={{ marginTop: 3, fontSize: 9, letterSpacing: 2, color: C.faint, fontFamily: "monospace" }}>OUT</div>
        </div>
      </div>
    </div>
  );

  const Shell = ({ i, section, children }: { i: number; section: string; children: React.ReactNode }) => (
    <div style={{ position: "relative" }}>
      <div
        ref={(el) => {
          refs.current[i] = el;
        }}
        style={{ width: W, height: H, background: C.ink, color: C.fg, borderRadius: 22, padding: 28, border: `1px solid ${C.line}`, boxSizing: "border-box", display: "flex", flexDirection: "column" }}
      >
        <Ident section={section} />
        <div style={{ flex: 1, marginTop: 20, minHeight: 0 }}>{children}</div>
        <div style={{ paddingTop: 12, borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 10, color: C.faint }}>
          <span>{d.minutes} min · sæson 25/26</span>
          <span>OtoScout</span>
        </div>
      </div>
      <button
        onClick={() => downloadOne(i)}
        style={{ position: "absolute", top: 10, right: 10, padding: "6px 10px", borderRadius: 8, background: C.volt, color: C.ink, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
      >
        ⬇ PNG
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: 580, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={downloadAll} disabled={busy}
          style={{ flex: 1, padding: "11px 14px", borderRadius: 10, background: C.volt, color: C.ink, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}>
          {busy ? "Renderer…" : `⬇ Download alle (${3})`}
        </button>
        <button onClick={copy}
          style={{ padding: "11px 14px", borderRadius: 10, background: "transparent", color: C.muted, fontSize: 13, border: `1px solid ${C.line}`, cursor: "pointer" }}>
          {copied ? "✓ Kopieret" : "⧉ Kopiér caption"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* ── Slide 1: Oversigt ── */}
        <Shell i={0} section="HIDDEN GEM">
          {role && (
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>
              {role}
              {bio && <span style={{ fontSize: 13, color: C.faint, fontWeight: 400 }}> · {bio}</span>}
            </div>
          )}
          {totals.length > 0 && (
            <>
              {secLabel("I sæsonen")}
              <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
                {totals.map((t) => (
                  <div key={t.label} style={{ flex: 1, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{t.value}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{t.label}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {strengths[0] && (
            <>
              {secLabel("Signatur")}
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {strengths[0].label}
              </div>
              <div style={{ fontSize: 15, color: C.muted, marginTop: 4 }}>
                {fmtStat(strengths[0].label, strengths[0].value)} · {topPhrase(strengths[0].pct)}
              </div>
            </>
          )}
        </Shell>

        {/* ── Slide 2: Stærkest ── */}
        <Shell i={1} section="STÆRKEST">
          {secLabel("Pr. 90 min · på tværs af 30 ligaer")}
          {strengths.map((s) => (
            <div key={s.label} style={{ marginBottom: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, gap: 10 }}>
                <span style={{ fontSize: 15, color: C.fg, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{s.label}</span>
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
        </Shell>

        {/* ── Slide 3: Værdi ── */}
        <Shell i={2} section="VÆRDI">
          {d.marketValue != null && d.valueSpread && (
            <>
              {secLabel("Markedsværdi vs. præstation")}
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 800 }}>{euro(d.marketValue)}</span>
                <span style={{ fontSize: 18, color: C.muted }}>→ {euro(d.valueSpread.median)}</span>
              </div>
              <div style={{ fontSize: 14, color: C.muted, marginBottom: 22 }}>
                leverer som <b style={{ color: C.fg }}>{euro(d.valueSpread.median)}</b>-profiler (ligemænd på stats + alder)
              </div>
            </>
          )}
          {peers.length > 0 && (
            <>
              {secLabel("Ligemænd (samme niveau, hvad de koster)")}
              <div style={{ marginBottom: 22 }}>
                {peers.map((p) => (
                  <div key={p.key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.line}`, fontSize: 14 }}>
                    <span>{p.player} <span style={{ color: C.faint, fontSize: 12 }}>· {p.league.split("-")[0]}</span></span>
                    <span style={{ fontWeight: 700 }}>{euro(p.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {big5 && (
            <>
              {secLabel("Statistisk tvilling i big-5")}
              <div style={{ fontSize: 20, fontWeight: 700 }}>{big5.player}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{big5.team}</div>
            </>
          )}
        </Shell>
      </div>

      {/* caption preview */}
      <div style={{ marginTop: 22 }}>
        <div style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.faint, marginBottom: 8 }}>Caption</div>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, lineHeight: 1.5, color: C.fg, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, margin: 0 }}>
          {caption}
        </pre>
      </div>
    </div>
  );
}
