import { NextRequest, NextResponse } from "next/server";
import { publishDueTargets } from "@/lib/publish-post";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Secured cron endpoint. Hit this every minute (or every few minutes) from
 * a cron scheduler. Pass the secret as a Bearer token:
 *
 *   Authorization: Bearer $CRON_SECRET
 */
async function handle(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") || req.nextUrl.searchParams.get("secret");
  const got = auth?.replace(/^Bearer\s+/i, "") ?? "";
  if (got !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await publishDueTargets();
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("publish-scheduled cron failed:", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
