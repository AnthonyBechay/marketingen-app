// Generic OAuth start route. /api/oauth/{provider}/connect?slug={projectSlug}
// builds a signed state token bound to (user, project, provider) and 302s
// to the provider's auth dialog. The matching callback route is below.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { signState } from "@/lib/oauth-state";
import { getProvider, providerEnabled } from "@/lib/providers";
import type { SocialProvider } from "@prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_PROVIDERS: SocialProvider[] = ["instagram", "linkedin"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { provider: providerParam } = await params;
  if (!ALLOWED_PROVIDERS.includes(providerParam as SocialProvider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  const provider = providerParam as SocialProvider;

  if (!(await providerEnabled(provider))) {
    return NextResponse.json(
      { error: `${provider} OAuth is not configured. An admin must add credentials in Settings.` },
      { status: 500 },
    );
  }

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const project = await db.project.findUnique({
    where: { userId_slug: { userId: user.id, slug } },
    select: { id: true, slug: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const state = signState({ userId: user.id, projectId: project.id, provider });
  const url = await getProvider(provider).oauthUrl(state);
  return NextResponse.redirect(url);
}
