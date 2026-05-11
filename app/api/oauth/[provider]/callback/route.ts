// Generic OAuth callback route. The provider redirects here with `code` +
// `state`; we verify the state, exchange the code via the provider adapter,
// and upsert a SocialConnection row.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { verifyState } from "@/lib/oauth-state";
import { getProvider } from "@/lib/providers";
import { publicUrl } from "@/lib/public-origin";
import type { Prisma, SocialProvider } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_PROVIDERS: SocialProvider[] = ["instagram", "linkedin"];

function backToConnections(
  req: NextRequest,
  slug: string,
  params: Record<string, string>,
) {
  const url = publicUrl(req, `/app/${slug}/connections`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return NextResponse.redirect(url);
}

function backToApp(req: NextRequest, error: string) {
  const url = publicUrl(req, "/app");
  url.searchParams.set("conn_error", error.slice(0, 240));
  return NextResponse.redirect(url);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.redirect(publicUrl(req, "/login"));

    const { provider: providerParam } = await params;
    if (!ALLOWED_PROVIDERS.includes(providerParam as SocialProvider)) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }
    const provider = providerParam as SocialProvider;

    const sp = req.nextUrl.searchParams;
    const code = sp.get("code");
    const state = sp.get("state");
    const errorDesc = sp.get("error_description") || sp.get("error");

    if (errorDesc) return backToApp(req, errorDesc);
    if (!code || !state) return backToApp(req, "missing_params");

    const verified = verifyState(state);
    if (!verified || verified.userId !== user.id || verified.provider !== provider) {
      return backToApp(req, "invalid_state");
    }

    const project = await db.project.findFirst({
      where: { id: verified.projectId, userId: user.id },
    });
    if (!project) return backToApp(req, "project_not_found");

    const info = await getProvider(provider).exchangeCode(code);
    await db.socialConnection.upsert({
      where: { projectId_provider: { projectId: project.id, provider } },
      update: {
        accountId: info.accountId,
        accountName: info.accountName,
        accountHandle: info.accountHandle,
        accessToken: info.accessToken,
        refreshToken: info.refreshToken,
        tokenExpiresAt: info.tokenExpiresAt,
        meta: info.meta as Prisma.InputJsonValue,
        lastError: null,
      },
      create: {
        projectId: project.id,
        provider,
        accountId: info.accountId,
        accountName: info.accountName,
        accountHandle: info.accountHandle,
        accessToken: info.accessToken,
        refreshToken: info.refreshToken,
        tokenExpiresAt: info.tokenExpiresAt,
        meta: info.meta as Prisma.InputJsonValue,
      },
    });
    return backToConnections(req, project.slug, { connected: provider });
  } catch (e) {
    const msg = (e as Error).message ?? "OAuth callback failed";
    console.error("oauth/callback failed:", msg);
    return backToApp(req, msg);
  }
}
