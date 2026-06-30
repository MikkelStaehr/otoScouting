// Team crests from ESPN's open CDN (loads in-browser, not hotlink-protected).
// Keyed by a normalised team name so FBref/Sofascore spelling variants resolve.
// Covers Superliga + Allsvenskan + Eliteserien 2025/26. Where FBref and
// Sofascore normalise differently (e.g. "molde" vs "molde fk"), both keys map
// to the same id. Ids via ESPN's core API (swe.1 / nor.1 / den.1).

const ESPN_ID: Record<string, number> = {
  // Superliga (DEN)
  agf: 7853,
  brondby: 575,
  copenhagen: 909,
  fredericia: 130912,
  midtjylland: 572,
  nordsjaelland: 3101,
  odense: 11550,
  randers: 3132,
  silkeborg: 607,
  sonderjyske: 8118,
  vejle: 12498,
  viborg: 3153,

  // Eliteserien (NOR)
  aalesund: 3278,
  "aalesunds fk": 3278,
  "bodo glimt": 2980,
  brann: 620,
  fredrikstad: 3039,
  "fredrikstad fk": 3039,
  hamkam: 21380,
  "kfum oslo": 22165,
  kristiansund: 6672,
  lillestrom: 987,
  molde: 2715,
  "molde fk": 2715,
  rosenborg: 438,
  sandefjord: 3279,
  "sandefjord fotball": 3279,
  sarpsborg: 5002,
  start: 6750,
  tromso: 5270,
  "tromso il": 5270,
  viking: 510,
  "viking fk": 510,
  valerenga: 2791,

  // Allsvenskan (SWE)
  aik: 994,
  "aik stockholm": 994,
  hacken: 7834,
  brommapojkarna: 8221,
  degerfors: 20856,
  djurgarden: 2339,
  djurgardens: 2339,
  elfsborg: 529,
  gais: 8222,
  goteborg: 2556,
  "ifk goteborg": 2556,
  halmstad: 3017,
  halmstads: 3017,
  hammarby: 2495,
  kalmar: 3052,
  malmo: 2720,
  mjallby: 20301,
  "mjallby aif": 20301,
  sirius: 8547,
  vasteras: 22163,
  orgryte: 131552,
  "orgryte is": 131552,
};

function norm(team: string): string {
  return team
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\b(fc|if|bk|sk|ik|ob|ff|boldklub|fodbold)\b/g, " ")
    .replace(/kobenhavn/, "copenhagen")
    .replace(/\s+/g, " ")
    .trim();
}

export function teamLogoUrl(team: string): string | null {
  const id = ESPN_ID[norm(team)];
  return id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png` : null;
}
