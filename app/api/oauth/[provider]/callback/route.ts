// Generic OAuth callback route. The provider redirects here with `code` +
// `state`; we verify the state, exchange the code via the provider adapter,
// and upsert a SocialConnection row.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { verifyState } from "@/lib/oauth-state";
import { getProvider } from "@/lib/providers";
import type { Prisma, SocialProvider } from "@prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_PROVIDERS: SocialProvider[] = ["instagram", "linkedin"];

function backToConnections(
  req: NextRequest,
  slug: string,
  params: Record<string, string>,
) {
  const url = new URL(`/app/${slug}/connections`, req.url);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return NextResponse.redirect(url);
}

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

  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const errorDesc = sp.get("error_description") || sp.get("error");

  if (errorDesc) {
    return NextResponse.redirect(
      new URL(`/app?conn_error=${encodeURIComponent(errorDesc)}`, req.url),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/app?conn_error=missing_params", req.url));
  }

  const verified = verifyState(state);
  if (!verified || verified.userId !== user.id || verified.provider !== provider) {
    return NextResponse.redirect(new URL("/app?conn_error=invalid_state", req.url));
  }

  const project = await db.project.findFirst({
    where: { id: verified.projectId, userId: user.id },
  });
  if (!project) {
    return NextResponse.redirect(new URL("/app?conn_error=project_not_found", req.url));
  }

  try {
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
    return backToConnections(req, project.slug, {
      conn_error: (e as Error).message.slice(0, 240),
    });
  }
}
