// Generic OAuth start route. /api/oauth/{provider}/connect?slug={projectSlug}
// builds a signed state token bound to (user, project, provider) and 302s
// to the provider's auth dialog. The matching callback route lives next to
// this one. Errors are caught and either redirected (so the user lands back
// in the app) or returned as JSON for API debugging.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { signState } from "@/lib/oauth-state";
import { getProvider, providerEnabled } from "@/lib/providers";
import type { SocialProvider } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_PROVIDERS: SocialProvider[] = ["instagram", "linkedin"];

function backWithError(req: NextRequest, slug: string | null, msg: string) {
  const target = slug ? `/app/${slug}/connections` : "/app";
  const url = new URL(target, req.url);
  url.searchParams.set("conn_error", msg.slice(0, 240));
  return NextResponse.redirect(url);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const slug = req.nextUrl.searchParams.get("slug");
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.redirect(new URL("/login", req.url));

    const { provider: providerParam } = await params;
    if (!ALLOWED_PROVIDERS.includes(providerParam as SocialProvider)) {
      return backWithError(req, slug, "Unknown provider");
    }
    const provider = providerParam as SocialProvider;

    if (!(await providerEnabled(provider))) {
      return backWithError(
        req,
        slug,
        `${provider} OAuth is not configured yet — an admin must add credentials in Settings → OAuth apps.`,
      );
    }

    if (!slug) return backWithError(req, null, "Missing project slug");

    const project = await db.project.findUnique({
      where: { userId_slug: { userId: user.id, slug } },
      select: { id: true, slug: true },
    });
    if (!project) return backWithError(req, null, "Project not found");

    const state = signState({ userId: user.id, projectId: project.id, provider });
    const url = await getProvider(provider).oauthUrl(state);
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = (e as Error).message ?? "OAuth start failed";
    console.error("oauth/connect failed:", msg);
    return backWithError(req, slug, msg);
  }
}
