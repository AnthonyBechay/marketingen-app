// Instagram (Business Login) provider adapter.
//
// Uses Meta's "API setup with Instagram Login" — pure-Instagram OAuth, no
// Facebook Page mediation. The user logs in at instagram.com, grants
// scopes for their Business or Creator account, and we get back a token
// that publishes directly via graph.instagram.com.
//
// What you (the operator) configure in /admin/oauth or env:
//   - Instagram App ID + Instagram App Secret (NOT the Meta app's App ID)
//     Found in: Meta dashboard → your app → Instagram product → API setup
//     with Instagram business login → "Instagram app ID / secret".
//   - Redirect URI (must match the one whitelisted in that same setup
//     panel under "Business login settings → OAuth redirect URIs").
//
// What end users need:
//   - An Instagram Business or Creator account. That's it. No Facebook
//     Page, no Page admin role.
//
// Auth flow:
//   1. /oauth/authorize   → user approves on instagram.com
//   2. POST api.instagram.com/oauth/access_token  → short-lived token (1h)
//   3. GET  graph.instagram.com/access_token?grant_type=ig_exchange_token
//      → long-lived token (60 days). This is what we store.
//   4. GET  graph.instagram.com/v23.0/me  → user_id + username + account_type
//
// Refresh:
//   - Long-lived tokens self-renew via /refresh_access_token (must be at
//     least 24 hours old). We refresh opportunistically when there's
//     <7 days left on the clock.
//
// Publish flow (per post):
//   - Build a media container (one for single, N+1 for carousel)
//   - Poll until status_code == FINISHED
//   - POST /{ig-user-id}/media_publish with creation_id

import type { SocialConnection } from "@prisma/client";
import type {
  AccountInfo,
  PublishInput,
  PublishResult,
  SocialProviderImpl,
} from "./types";
import { getCreds } from "./credentials";

const IG_OAUTH_DIALOG = "https://www.instagram.com/oauth/authorize";
const IG_TOKEN = "https://api.instagram.com/oauth/access_token";
const IG_GRAPH = "https://graph.instagram.com";
const IG_API_VERSION = "v23.0";

const REQUIRED_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  // Future-proofing for inbox/comments features. Optional — IG will only
  // grant scopes your dev app has approved; the rest are dropped silently.
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
].join(",");

type IgMe = {
  user_id?: string | number;
  id?: string | number;
  username?: string;
  account_type?: string;
  name?: string;
};

async function fetchMe(accessToken: string): Promise<IgMe> {
  const url = new URL(`${IG_GRAPH}/${IG_API_VERSION}/me`);
  url.searchParams.set("fields", "user_id,username,account_type,name");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`Instagram /me failed: ${text}`);
  return JSON.parse(text) as IgMe;
}

async function exchangeShortToLong(
  shortToken: string,
  clientSecret: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const url = new URL(`${IG_GRAPH}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("access_token", shortToken);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`Long-lived token exchange failed: ${text}`);
  const data = JSON.parse(text) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function refreshLongLived(longToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const url = new URL(`${IG_GRAPH}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", longToken);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`Token refresh failed: ${text}`);
  const data = JSON.parse(text) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function createMediaContainer(
  igUserId: string,
  token: string,
  fields: Record<string, string>,
): Promise<string> {
  const body = new URLSearchParams({ ...fields, access_token: token });
  const res = await fetch(`${IG_GRAPH}/${IG_API_VERSION}/${igUserId}/media`, {
    method: "POST",
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Create container failed: ${text}`);
  return (JSON.parse(text) as { id: string }).id;
}

async function waitForContainerReady(
  token: string,
  containerId: string,
  maxAttempts = 30,
  intervalMs = 2000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${IG_GRAPH}/${IG_API_VERSION}/${containerId}?fields=status_code&access_token=${token}`,
    );
    if (!res.ok) throw new Error(`Status check failed: ${await res.text()}`);
    const data = (await res.json()) as { status_code: string };
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(`Container ${data.status_code.toLowerCase()}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Container processing timed out");
}

async function finalize(
  igUserId: string,
  token: string,
  containerId: string,
): Promise<string> {
  await waitForContainerReady(token, containerId);
  const res = await fetch(`${IG_GRAPH}/${IG_API_VERSION}/${igUserId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: containerId, access_token: token }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Publish failed: ${text}`);
  return (JSON.parse(text) as { id: string }).id;
}

export const instagramProvider: SocialProviderImpl = {
  id: "instagram",
  meta: { name: "Instagram", color: "#e1306c" },

  async oauthUrl(state: string): Promise<string> {
    const creds = await getCreds("instagram");
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: creds.redirectUri,
      response_type: "code",
      scope: REQUIRED_SCOPES,
      state,
    });
    return `${IG_OAUTH_DIALOG}?${params}`;
  },

  async exchangeCode(code: string): Promise<AccountInfo> {
    const creds = await getCreds("instagram");

    // Step 1: short-lived token (good for ~1 hour, but we immediately
    // upgrade it to a long-lived one).
    const body = new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: creds.redirectUri,
      code,
    });
    const shortRes = await fetch(IG_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const shortText = await shortRes.text();
    if (!shortRes.ok) {
      throw new Error(`Instagram code exchange failed: ${shortText}`);
    }
    const short = JSON.parse(shortText) as {
      access_token: string;
      user_id: number | string;
    };

    // Step 2: long-lived token (60 days).
    const long = await exchangeShortToLong(short.access_token, creds.clientSecret);

    // Step 3: profile lookup. The /me endpoint also confirms the account
    // type — we reject Personal accounts here because Instagram won't let
    // us publish to them anyway.
    const me = await fetchMe(long.accessToken);
    const accountId = String(me.user_id ?? me.id ?? short.user_id);
    const accountType = (me.account_type ?? "").toUpperCase();
    if (accountType && accountType !== "BUSINESS" && accountType !== "MEDIA_CREATOR") {
      throw new Error(
        `Instagram account "${me.username ?? accountId}" is a ${accountType} account. ` +
          `Switch it to Business or Creator in the Instagram app first, then reconnect.`,
      );
    }

    return {
      accountId,
      accountName: me.name ?? null,
      accountHandle: me.username ?? null,
      accessToken: long.accessToken,
      // IG Business Login doesn't issue a separate refresh token — long-lived
      // tokens self-renew via /refresh_access_token using the same token.
      refreshToken: null,
      tokenExpiresAt: long.expiresAt,
      meta: {
        username: me.username ?? null,
        accountType: accountType || null,
        name: me.name ?? null,
      },
    };
  },

  async maybeRefresh(connection: SocialConnection): Promise<AccountInfo | null> {
    // Refresh only when within 7 days of expiry (and the token must already
    // be at least 24h old, which it always is by the time we get here).
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (
      !connection.tokenExpiresAt ||
      connection.tokenExpiresAt.getTime() - Date.now() > sevenDays
    ) {
      return null;
    }
    try {
      const refreshed = await refreshLongLived(connection.accessToken);
      return {
        accountId: connection.accountId,
        accountName: connection.accountName,
        accountHandle: connection.accountHandle,
        accessToken: refreshed.accessToken,
        refreshToken: null,
        tokenExpiresAt: refreshed.expiresAt,
        meta: (connection.meta as Record<string, unknown>) ?? {},
      };
    } catch (e) {
      console.warn("Instagram token refresh failed:", (e as Error).message);
      return null;
    }
  },

  async publish(connection: SocialConnection, input: PublishInput): Promise<PublishResult> {
    try {
      const igUserId = connection.accountId;
      const token = connection.accessToken;
      const { imageUrls, caption, format } = input;
      if (imageUrls.length === 0) throw new Error("No images to publish");

      let mediaId: string;
      if (format === "story") {
        const id = await createMediaContainer(igUserId, token, {
          image_url: imageUrls[0],
          media_type: "STORIES",
        });
        mediaId = await finalize(igUserId, token, id);
      } else if (format === "single" || imageUrls.length === 1) {
        const id = await createMediaContainer(igUserId, token, {
          image_url: imageUrls[0],
          caption,
        });
        mediaId = await finalize(igUserId, token, id);
      } else {
        // Carousel: 2-10 children, then a parent CAROUSEL container.
        const slides = imageUrls.slice(0, 10);
        const childIds: string[] = [];
        for (const url of slides) {
          const id = await createMediaContainer(igUserId, token, {
            image_url: url,
            is_carousel_item: "true",
          });
          childIds.push(id);
        }
        const parentId = await createMediaContainer(igUserId, token, {
          media_type: "CAROUSEL",
          children: childIds.join(","),
          caption,
        });
        mediaId = await finalize(igUserId, token, parentId);
      }
      return {
        ok: true,
        providerPostId: mediaId,
        // The numeric media id doesn't directly form a public URL (we'd
        // need the shortcode, which Graph doesn't surface). Leave null.
        providerUrl: null,
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};
