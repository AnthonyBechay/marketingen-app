import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { instagramOAuthUrl } from "@/lib/instagram";
import { signState } from "@/lib/oauth-state";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const project = await db.project.findUnique({
    where: { userId_slug: { userId: user.id, slug } },
    select: { id: true, slug: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const state = signState({ userId: user.id, projectId: project.id });
  return NextResponse.redirect(instagramOAuthUrl(state));
}
