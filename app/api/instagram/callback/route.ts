import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  exchangeCodeForToken,
  findInstagramAccount,
  getLongLivedUserToken,
} from "@/lib/instagram";
import { verifyState } from "@/lib/oauth-state";

export const dynamic = "force-dynamic";

function backTo(req: NextRequest, slug: string, params: Record<string, string>) {
  const url = new URL(`/app/${slug}`, req.url);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const errorDesc = params.get("error_description") || params.get("error");

  if (errorDesc) {
    // User cancelled or Meta rejected — try to send them home with a message.
    return NextResponse.redirect(
      new URL(`/app?ig_error=${encodeURIComponent(errorDesc)}`, req.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/app?ig_error=missing_params", req.url));
  }

  const verified = verifyState(state);
  if (!verified || verified.userId !== user.id) {
    return NextResponse.redirect(new URL("/app?ig_error=invalid_state", req.url));
  }

  const project = await db.project.findFirst({
    where: { id: verified.projectId, userId: user.id },
  });
  if (!project) {
    return NextResponse.redirect(new URL("/app?ig_error=project_not_found", req.url));
  }

  try {
    // 1. Exchange code → short-lived user token
    const shortLived = await exchangeCodeForToken(code);
    // 2. Exchange short → long-lived user token (60 days)
    const longLived = await getLongLivedUserToken(shortLived.accessToken);
    // 3. Find a Page with linked Instagram Business account
    const ig = await findInstagramAccount(longLived.accessToken);

    if (!ig) {
      return backTo(req, project.slug, {
        ig_error:
          "No Instagram Business account found. Switch your Instagram to Business/Creator and link it to a Facebook Page.",
      });
    }

    // 4. Persist (upsert — connecting again replaces the previous connection).
    await db.instagramConnection.upsert({
      where: { projectId: project.id },
      update: {
        igUserId: ig.igUserId,
        igUsername: ig.igUsername,
        pageId: ig.pageId,
        pageName: ig.pageName,
        accessToken: ig.pageAccessToken,
        tokenExpiresAt: longLived.expiresAt,
        lastError: null,
      },
      create: {
        projectId: project.id,
        igUserId: ig.igUserId,
        igUsername: ig.igUsername,
        pageId: ig.pageId,
        pageName: ig.pageName,
        accessToken: ig.pageAccessToken,
        tokenExpiresAt: longLived.expiresAt,
      },
    });

    return backTo(req, project.slug, { ig_connected: "1" });
  } catch (e) {
    return backTo(req, project.slug, {
      ig_error: (e as Error).message.slice(0, 240),
    });
  }
}
