// The ⌘K palette's player index — every player across every league. Fetched once
// on first open (not shipped in every page's payload). Cached server-side on the
// data version, so it's cheap after the first call.

import { getAllPlayerIndex } from "@/lib/players";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getAllPlayerIndex());
}
