// One-line Danish descriptions per role (client-safe, pure data) — shown as a
// hover tooltip on the role badge and in the role filter. Each line says what the
// role means + the behaviour that defines it (positioning + stats).

export const ROLE_DESC: Record<string, string> = {
  // GK
  "Shot-Stopper": "Klassisk målmand — lever af redninger og goals prevented, bliver på stregen.",
  "Ball-Playing GK": "Boldspillende målmand — høj afleveringspræcision og volumen, starter opspillet.",
  "Sweeper Keeper": "Sweeper-keeper — høj gennemsnitsposition (kommer ud af feltet) + god distribution.",
  "No-Nonsense GK": "Sikkerheds-målmand — sparker langt, lav andel af korte afleveringer.",
  // CB
  "Ball-Playing CB": "Boldspillende stopper — høj pass% og fremdrift i sidste tredjedel.",
  "No-Nonsense CB": "Ren stopper — clearances og luftdueller, minimalt boldspil.",
  "Stopper": "Aggressiv stopper — mange tacklinger/erobringer, træder ud på modstanderen.",
  "Wide CB": "Bred midterforsvarer — placerer sig ude i en 3-kæde, stærk i luften.",
  "Aggressive CB": "Fremskudt stopper — vinder bolde højt oppe, forsvarer offensivt.",
  // Backs
  "Attacking Wing-Back": "Offensiv wing-back — skyder højt op i angreb, indlæg og oplæg.",
  "Holding Full-Back": "Defensiv back — bliver hjemme, tacklinger og erobringer, få indlæg.",
  "Inverted Full-Back": "Inverteret back — rykker ind centralt med bolden, høj afleveringspræcision.",
  "Pressing Full-Back": "Pressende back — vinder bolde højt, aggressiv i presset.",
  // Midfield
  "Anchor": "Ankermand — dyb, tacklinger og erobringer, skærmer forsvaret.",
  "Deep-Lying Playmaker": "Dyb playmaker — dikterer spillet bagfra med høj pass% og volumen.",
  "Box-to-Box": "Box-to-box — dækker meget bane, bidrager både offensivt og defensivt.",
  "Advanced Playmaker": "Offensiv playmaker — fremskudt, skaber chancer og store chancer.",
  // Wide
  "Winger": "Klassisk kant — bliver bred, indlæg og driblinger.",
  "Inside Forward": "Inside forward — kant der søger mod mål, skud og scoringer.",
  "Wide Playmaker": "Kant-playmaker — skaber fra kanten (oplæg + driblinger) frem for at afslutte.",
  // Strikers
  "Poacher": "Afslutter — høj scoring/xG, lav involvering, lever i feltet.",
  "Target Forward": "Boldfast angriber — dominerer i luften, holder bolden op.",
  "Deep-Lying Forward": "Faldende angriber / falsk 9'er — dropper dybt og forbinder spillet.",
  "Complete Forward": "Komplet angriber — scorer, skaber og dribler.",
};

export const roleDesc = (role: string | null | undefined) => (role ? ROLE_DESC[role] ?? "" : "");

// Roles grouped by line — the order/structure for the role filter dropdown.
export const ROLE_BUCKET: Record<string, string> = {};
export const BUCKET_LABEL: Record<string, string> = {};
export const BUCKET_ORDER = ["GK", "CB", "BACK", "MID", "WIDE", "STRIKER"];

export const ROLE_GROUPS: { bucket: string; label: string; roles: string[] }[] = [
  { bucket: "GK", label: "Målmænd", roles: ["Shot-Stopper", "Ball-Playing GK", "Sweeper Keeper", "No-Nonsense GK"] },
  { bucket: "CB", label: "Midterforsvar", roles: ["Ball-Playing CB", "No-Nonsense CB", "Stopper", "Wide CB", "Aggressive CB"] },
  { bucket: "BACK", label: "Backer", roles: ["Attacking Wing-Back", "Holding Full-Back", "Inverted Full-Back", "Pressing Full-Back"] },
  { bucket: "MID", label: "Central midtbane", roles: ["Anchor", "Deep-Lying Playmaker", "Box-to-Box", "Advanced Playmaker"] },
  { bucket: "WIDE", label: "Kant", roles: ["Winger", "Inside Forward", "Wide Playmaker"] },
  { bucket: "STRIKER", label: "Angreb", roles: ["Poacher", "Target Forward", "Deep-Lying Forward", "Complete Forward"] },
];

for (const g of ROLE_GROUPS) {
  BUCKET_LABEL[g.bucket] = g.label;
  for (const r of g.roles) ROLE_BUCKET[r] = g.bucket;
}

