// Instagram (Facebook Graph) provider adapter.
//
// OAuth is the standard Facebook dialog. After the code exchange we walk
// the user's Pages and find one with a linked Instagram Business account;
// the Page-scoped token is what gets stored (it's what the IG Graph
// endpoints actually accept). Page tokens issued from a long-lived user
// token live as long as the user token, so we refresh the user token
// opportunistically — but the value we keep in `accessToken` is the page
// token. The original (long-lived) user token is kept in `refreshToken`
// so we can re-derive the page token on refresh.

import type { SocialConnection } from "@prisma/client";
import type {
  AccountInfo,
  PublishInput,
  PublishResult,
  SocialProviderImpl,
} from "./types";
import { getCreds } from "./credentials";

const FB_API_VERSION = "v23.0";
const FB_API_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;
const FB_OAUTH_DIALOG = `https://www.facebook.com/${FB_API_VERSION}/dialog/oauth`;

const REQUIRED_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const creds = await getCreds("instagram");
  const params = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: creds.redirectUri,
    code,
  });
  const res = await fetch(`${FB_API_BASE}/oauth/access_token?${params}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`OAuth code exchange failed: ${text}`);
  const data = JSON.parse(text) as { access_token: string; expires_in?: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 };
}

async function getLongLivedUserToken(shortToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const creds = await getCreds("instagram");
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    fb_exchange_token: shortToken,
  });
  const res = await fetch(`${FB_API_BASE}/oauth/access_token?${params}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`Long-lived token exchange failed: ${text}`);
  const data = JSON.parse(text) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function findInstagramAccount(userToken: string) {
  const fields = "id,name,access_token,instagram_business_account";
  const pagesRes = await fetch(
    `${FB_API_BASE}/me/accounts?fields=${fields}&access_token=${userToken}`,
  );
  const pagesText = await pagesRes.text();
  if (!pagesRes.ok) throw new Error(`Pages fetch failed: ${pagesText}`);
  const pagesData = JSON.parse(pagesText) as {
    data: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string };
    }>;
  };

  for (const page of pagesData.data) {
    if (!page.instagram_business_account) continue;
    const igRes = await fetch(
      `${FB_API_BASE}/${page.instagram_business_account.id}?fields=username&access_token=${page.access_token}`,
    );
    let igUsername: string | null = null;
    if (igRes.ok) {
      const igJson = (await igRes.json()) as { username?: string };
      igUsername = igJson.username ?? null;
    }
    return {
      igUserId: page.instagram_business_account.id,
      igUsername,
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: page.access_token,
    };
  }
  return null;
}

async function createMediaContainer(
  igUserId: string,
  token: string,
  fields: Record<string, string>,
): Promise<string> {
  const body = new URLSearchParams({ ...fields, access_token: token });
  const res = await fetch(`${FB_API_BASE}/${igUserId}/media`, { method: "POST", body });
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
      `${FB_API_BASE}/${containerId}?fields=status_code&access_token=${token}`,
    );
    if (!res.ok) {
      throw new Error(`Status check failed: ${await res.text()}`);
    }
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
  const res = await fetch(`${FB_API_BASE}/${igUserId}/media_publish`, {
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
      scope: REQUIRED_SCOPES,
      response_type: "code",
      state,
    });
    return `${FB_OAUTH_DIALOG}?${params}`;
  },

  async exchangeCode(code: string): Promise<AccountInfo> {
    const shortLived = await exchangeCodeForToken(code);
    const longLived = await getLongLivedUserToken(shortLived.accessToken);
    const ig = await findInstagramAccount(longLived.accessToken);
    if (!ig) {
      throw new Error(
        "No Instagram Business account found. Switch your Instagram to Business/Creator and link it to a Facebook Page.",
      );
    }
    return {
      accountId: ig.igUserId,
      accountName: ig.pageName,
      accountHandle: ig.igUsername,
      // Store the page-scoped token (what IG endpoints accept) as the
      // primary access token; keep the long-lived user token as a refresh
      // material so we can reissue page tokens later if needed.
      accessToken: ig.pageAccessToken,
      refreshToken: longLived.accessToken,
      tokenExpiresAt: longLived.expiresAt,
      meta: {
        pageId: ig.pageId,
        pageName: ig.pageName,
        igUsername: ig.igUsername,
      },
    };
  },

  async maybeRefresh(connection: SocialConnection): Promise<AccountInfo | null> {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (
      !connection.tokenExpiresAt ||
      connection.tokenExpiresAt.getTime() - Date.now() > sevenDays
    ) {
      return null;
    }
    const userToken = connection.refreshToken ?? connection.accessToken;
    try {
      const refreshed = await getLongLivedUserToken(userToken);
      const ig = await findInstagramAccount(refreshed.accessToken);
      if (!ig) throw new Error("Instagram account no longer accessible");
      return {
        accountId: ig.igUserId,
        accountName: ig.pageName,
        accountHandle: ig.igUsername,
        accessToken: ig.pageAccessToken,
        refreshToken: refreshed.accessToken,
        tokenExpiresAt: refreshed.expiresAt,
        meta: {
          pageId: ig.pageId,
          pageName: ig.pageName,
          igUsername: ig.igUsername,
        },
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
        // IG doesn't give us a stable shortcode in the Graph response — the
        // numeric media id deep-links via instagram.com/p/{shortcode} but we
        // don't have the shortcode here. Leave url null for now.
        providerUrl: null,
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};
