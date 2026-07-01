// Team defensive weakness map (zones + covering player + strength).

import { getTeamWeakness } from "@/lib/weakness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const league = u.searchParams.get("league");
  const team = u.searchParams.get("team");
  if (!league || !team) return Response.json({ error: "missing league/team" }, { status: 400 });
  const w = getTeamWeakness(league, team);
  if (!w) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(w);
}
