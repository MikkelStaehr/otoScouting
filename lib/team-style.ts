// Team playing-style identity — two descriptive roles per team, FM26-style: one
// IN possession (IP) and one OUT of possession (OOP), since a team's style is
// rarely one thing (Atalanta ≈ City with the ball, wildly different without it).
// Rule-based + term-scored (transparent, debuggable) from league-relative team
// signals. Honest limits: no PPDA / sequences / transition-xG (needs event data),
// so pressing is proxied by high turnovers, directness by long balls, etc.

export interface StyleFit {
  style: string;
  conf: number;
  why: string[];
}
export interface StyleResult {
  primary: StyleFit | null;
  secondary: StyleFit | null;
}
export interface TeamStyle {
  ip: StyleResult; // with the ball
  oop: StyleResult; // without the ball
}

const clamp = (x: number) => Math.max(0, Math.min(100, x));

// All signals are 0-100 (percentile within the league, or a derived proxy).
export type StyleSig = Record<string, number>;

const LABEL: Record<string, string> = {
  possession: "Boldbesiddelse",
  pass_pct: "Afleveringspræcision",
  xg: "xG",
  big_chances: "Store chancer",
  longball: "Lange bolde",
  aerials: "Luftdueller",
  crosses: "Indlæg",
  corners: "Hjørnespark",
  pressHigh: "Erobringer højt",
  interceptions: "Erobringer",
  tackles: "Tacklinger",
  duels: "Dueller",
  solidShots: "Få skud imod",
  cleanSheets: "Clean sheets",
  midPress: "mellemhøjt pres",
};

interface Term { k: string; w: number; inv?: boolean }

const IP_STYLES: { style: string; terms: Term[] }[] = [
  { style: "Positionsspil / dominans", terms: [{ k: "possession", w: 0.5 }, { k: "pass_pct", w: 0.35 }, { k: "xg", w: 0.15 }] },
  { style: "Vertikal transition", terms: [{ k: "possession", w: 0.35, inv: true }, { k: "xg", w: 0.3 }, { k: "big_chances", w: 0.2 }, { k: "longball", w: 0.15, inv: true }] },
  { style: "Direkte spil", terms: [{ k: "longball", w: 0.4 }, { k: "aerials", w: 0.3 }, { k: "pass_pct", w: 0.3, inv: true }] },
  { style: "Kantfokuseret", terms: [{ k: "crosses", w: 0.45 }, { k: "corners", w: 0.3 }, { k: "aerials", w: 0.25 }] },
  { style: "Kaosbold / andenbolde", terms: [{ k: "aerials", w: 0.4 }, { k: "longball", w: 0.3 }, { k: "corners", w: 0.3 }] },
];

// OOP is the press-height spectrum — the axis we CAN read from data (where the
// team wins the ball). Man-marking isn't reliably detectable from aggregate stats,
// so it's left out of v1 rather than mis-fired from "wins lots of duels".
const OOP_STYLES: { style: string; terms: Term[] }[] = [
  { style: "Højtryk / gegenpress", terms: [{ k: "pressHigh", w: 0.5 }, { k: "interceptions", w: 0.25 }, { k: "possession", w: 0.25 }] },
  { style: "Midterblok", terms: [{ k: "midPress", w: 0.55 }, { k: "interceptions", w: 0.25 }, { k: "tackles", w: 0.2 }] },
  { style: "Lavblok", terms: [{ k: "pressHigh", w: 0.45, inv: true }, { k: "possession", w: 0.3, inv: true }, { k: "solidShots", w: 0.25 }] },
];

const val = (t: Term, s: StyleSig): number => {
  const raw = s[t.k] ?? 50;
  return t.inv ? 100 - raw : raw;
};
const label = (t: Term, s: StyleSig): string => {
  const p = Math.round(s[t.k] ?? 50);
  const nm = LABEL[t.k] ?? t.k;
  if (t.k === "midPress") return "mellemhøjt pres";
  return t.inv ? `lav ${nm} (${p}p)` : `${nm} (${p}p)`;
};

function explain(terms: Term[], s: StyleSig): string[] {
  const scored = terms.map((t) => ({ t, v: val(t, s), c: t.w * val(t, s) })).sort((a, b) => b.c - a.c);
  const strong = scored.filter((x) => x.v >= 55);
  return (strong.length ? strong : scored).slice(0, 3).map((x) => label(x.t, s));
}

function classify(styles: { style: string; terms: Term[] }[], s: StyleSig, secMin: number): StyleResult {
  const ranked = styles
    .map((d) => ({ style: d.style, conf: Math.round(clamp(d.terms.reduce((a, t) => a + t.w * val(t, s), 0))), terms: d.terms }))
    .sort((a, b) => b.conf - a.conf);
  const fit = (r: (typeof ranked)[number]): StyleFit => ({ style: r.style, conf: r.conf, why: explain(r.terms, s) });
  return {
    primary: ranked[0] ? fit(ranked[0]) : null,
    secondary: ranked[1] && ranked[1].conf >= secMin ? fit(ranked[1]) : null,
  };
}

export function classifyTeamStyle(s: StyleSig): TeamStyle {
  const sig = { ...s, midPress: clamp(100 - Math.abs((s.pressHigh ?? 50) - 50) * 2) };
  return { ip: classify(IP_STYLES, sig, 45), oop: classify(OOP_STYLES, sig, 45) };
}
