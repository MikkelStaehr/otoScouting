// Plottable axes for the dashboard scatter. Player keys read EnrichedPlayer.per90;
// team keys read EnrichedTeam.value (per match). Kept dependency-free so the
// client scatter and the server point-builder share one definition.

export interface Axis {
  key: string;
  label: string;
}

export const PLAYER_AXES: Axis[] = [
  { key: "goals", label: "Mål /90" },
  { key: "npg", label: "Mål u. straffe /90" },
  { key: "xg", label: "xG /90" },
  { key: "assists", label: "Assists /90" },
  { key: "xa", label: "xA /90" },
  { key: "key_passes", label: "Chances created /90" },
  { key: "big_chances_created", label: "Store chancer skabt /90" },
  { key: "dribbles", label: "Driblinger /90" },
  { key: "acc_crosses", label: "Præcise indlæg /90" },
  { key: "shots", label: "Skud /90" },
  { key: "sot", label: "Skud på mål /90" },
  { key: "crosses", label: "Indlæg /90" },
  { key: "interceptions", label: "Erobringer /90" },
  { key: "tackles", label: "Tacklinger /90" },
  { key: "tackles_won", label: "Tacklinger vundet /90" },
  { key: "clearances", label: "Clearances /90" },
  { key: "blocks", label: "Blokeringer /90" },
  { key: "ball_recovery", label: "Boldgenerobringer /90" },
  { key: "aerial_won", label: "Luftdueller vundet /90" },
  { key: "poss_won_att_third", label: "Erobringer i angreb /90" },
  { key: "final_third_passes", label: "Afl. i sidste tredjedel /90" },
  { key: "long_balls", label: "Lange bolde /90" },
  { key: "duels_won_pct", label: "Vundne dueller %" },
  { key: "pass_pct", label: "Afleveringspræcision %" },
  { key: "g_minus_xg", label: "Mål − xG (finishing)" },
  { key: "conv_pct", label: "Konvertering %" },
];

export const TEAM_AXES: Axis[] = [
  { key: "goals", label: "Mål /kamp" },
  { key: "xg", label: "xG /kamp" },
  { key: "shots", label: "Skud /kamp" },
  { key: "sot", label: "Skud på mål /kamp" },
  { key: "big_chances", label: "Store chancer /kamp" },
  { key: "possession", label: "Boldbesiddelse %" },
  { key: "pass_pct", label: "Afleveringspræcision %" },
  { key: "goals_conceded", label: "Mål imod /kamp" },
  { key: "shots_against", label: "Skud imod /kamp" },
];

/** These metric pairs share a unit, so the y=x reference line is meaningful. */
export const DIAGONAL_PAIRS = new Set(["goals|xg", "npg|xg", "goals_conceded|shots_against"]);

/** Short plain-language description of what each axis measures — shown as a hint
 *  when the axis is picked, so the scatter explains itself. */
export const AXIS_DESC: Record<string, string> = {
  goals: "mål scoret pr. 90 min.",
  npg: "mål uden straffespark pr. 90 — ren afslutning",
  xg: "forventede mål (chancekvalitet) pr. 90",
  assists: "assists pr. 90",
  xa: "forventede assists (afgørende afl.) pr. 90",
  key_passes: "afleveringer der fører til skud, pr. 90",
  big_chances_created: "oplagte målchancer skabt pr. 90",
  dribbles: "vellykkede driblinger pr. 90",
  acc_crosses: "præcise indlæg pr. 90",
  shots: "skud pr. 90",
  sot: "skud på mål pr. 90",
  crosses: "indlæg pr. 90",
  interceptions: "erobrede bolde (aflæsninger) pr. 90",
  tackles: "tacklinger pr. 90",
  tackles_won: "vundne tacklinger pr. 90",
  clearances: "clearances pr. 90",
  blocks: "blokeringer pr. 90",
  ball_recovery: "generobrede bolde pr. 90",
  aerial_won: "vundne luftdueller pr. 90",
  poss_won_att_third: "boldgenerobringer i angrebstredjedelen pr. 90",
  final_third_passes: "afleveringer i sidste tredjedel pr. 90",
  long_balls: "lange bolde pr. 90",
  duels_won_pct: "andel dueller vundet (%)",
  pass_pct: "afleveringspræcision (%)",
  g_minus_xg: "mål minus xG — positivt = scorer mere end chancerne tilsiger",
  conv_pct: "andel skud der bliver til mål (%)",
  // teams
  possession: "boldbesiddelse (%)",
  big_chances: "oplagte målchancer pr. kamp",
  goals_conceded: "mål lukket ind pr. kamp",
  shots_against: "skud imod pr. kamp",
};
