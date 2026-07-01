// Player detail + statistically-similar players (by percentile-profile distance).
// Cheap after the first call — the cross-league board is cached until data changes.

import { getPlayerDetail } from "@/lib/similar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return Response.json({ error: "missing key" }, { status: 400 });
  const detail = getPlayerDetail(key);
  if (!detail) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(detail);
}
