import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch (error) {
    return NextResponse.json(
      { status: "degraded", db: "error", error: (error as Error).message },
      { status: 503 }
    );
  }
}
