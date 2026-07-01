// Team crests, self-hosted from Sofascore. Every team in scouting.db has a
// sofascore_team_id, so pipeline/fetch_logos.py downloads each crest to
// public/logos/sofascore/{id}.png and writes config/team-logos.json mapping every
// normalised team name (FBref + Sofascore spellings) to its id — 100% coverage,
// no runtime dependency on Sofascore (the images are local static files).

import generated from "../config/team-logos.json";

const CREST_ID: Record<string, number> = generated as Record<string, number>;

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
  const id = CREST_ID[norm(team)];
  return id ? `/logos/sofascore/${id}.png` : null;
}
