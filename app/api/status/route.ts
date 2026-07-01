// Live per-league loaded counts for the Settings data-status panel. Read-only;
// polled while the panel is open so an in-progress ingest is visible.

import { getLeagueStatus } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(getLeagueStatus());
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
