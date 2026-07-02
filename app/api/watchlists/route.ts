// Watch lists CRUD — GET returns all lists, POST applies one mutation and returns
// the updated set. Backed by data/watchlists.json (single-user, local).

import { getWatchlists, mutateWatchlists, type WatchOp } from "@/lib/watchlists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ lists: getWatchlists() });
}

export async function POST(req: Request) {
  let body: WatchOp;
  try {
    body = (await req.json()) as WatchOp;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (!body || typeof body.op !== "string") {
    return Response.json({ error: "missing op" }, { status: 400 });
  }
  try {
    const lists = mutateWatchlists(body);
    return Response.json({ lists });
  } catch {
    return Response.json({ error: "write failed" }, { status: 500 });
  }
}
