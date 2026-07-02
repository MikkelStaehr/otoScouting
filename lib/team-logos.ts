// Team crests. PRIMARY source is self-hosted Sofascore: every team in scouting.db
// has a sofascore_team_id, so pipeline/fetch_logos.py downloads each crest to
// public/logos/sofascore/{id}.png and writes config/team-logos.json mapping every
// normalised team name to its id. FALLBACK is ESPN's open API
// (pipeline/fetch_logos_espn.py -> public/logos/espn/{id}.png +
// config/team-logos-espn.json) — used for leagues not yet on Sofascore (e.g. the
// data is still being fetched) or any team Sofascore missed. Both are local static
// files, so there's no runtime dependency on either provider.

import generated from "../config/team-logos.json";
import espnGenerated from "../config/team-logos-espn.json";

const CREST_ID: Record<string, number> = generated as Record<string, number>;
const ESPN_ID: Record<string, string> = espnGenerated as Record<string, string>;

function norm(team: string): string {
  return team
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\b(fc|if|bk|sk|ik|ob|ff|boldklub|fodbold)\b/g, " ")
    .replace(/kobenhavn/, "copenhagen")
    .replace(/\s+/g, " ")
    .trim();
}

export function teamLogoUrl(team: string): string | null {
  const key = norm(team);
  const sofa = CREST_ID[key];
  if (sofa) return `/logos/sofascore/${sofa}.png`;
  const espn = ESPN_ID[key];
  if (espn) return `/logos/espn/${espn}.png`;
  return null;
}
