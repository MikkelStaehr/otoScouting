// Full team report: season performance profile + league ranks + strengths/
// weaknesses + defensive-zone weakness + recruitment fits.

import { getTeamReport } from "@/lib/team-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const league = u.searchParams.get("league");
  const team = u.searchParams.get("team");
  if (!league || !team) return Response.json({ error: "missing league/team" }, { status: 400 });
  const r = getTeamReport(league, team);
  if (!r) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(r);
}
