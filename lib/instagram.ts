// Instagram Graph API client.
//
// Auth flow:
//   1. instagramOAuthUrl(state) → redirect user to Meta
//   2. exchangeCodeForToken(code) → short-lived user token
//   3. getLongLivedUserToken(short) → 60-day user token
//   4. findInstagramAccount(longUserToken) → page id + ig business id +
//      a Page-scoped token (this is what we store, not the user token)
//
// Publishing flow (per post):
//   - Build a media container (or many for carousels)
//   - Poll until status_code == FINISHED
//   - Call media_publish with the creation_id
//
// All API errors are surfaced verbatim from Meta; the caller is expected
// to log / persist them on the connection or the post.

const FB_API_VERSION = "v23.0";
const FB_API_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;
const FB_OAUTH_DIALOG = `https://www.facebook.com/${FB_API_VERSION}/dialog/oauth`;

// Meta's required permissions for posting on behalf of a Page-linked IG account.
const REQUIRED_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export type IgAccount = {
  igUserId: string;
  igUsername: string | null;
  pageId: string;
  pageName: string | null;
  pageAccessToken: string; // Page-scoped — use this for all subsequent calls
  pageTokenExpiresAt: Date | null;
};

// ─── OAuth ────────────────────────────────────────────────────────

export function instagramOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("META_APP_ID"),
    redirect_uri: requireEnv("META_REDIRECT_URI"),
    scope: REQUIRED_SCOPES,
    response_type: "code",
    state,
  });
  return `${FB_OAUTH_DIALOG}?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const params = new URLSearchParams({
    client_id: requireEnv("META_APP_ID"),
    client_secret: requireEnv("META_APP_SECRET"),
    redirect_uri: requireEnv("META_REDIRECT_URI"),
    code,
  });
  const res = await fetch(`${FB_API_BASE}/oauth/access_token?${params}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`OAuth code exchange failed: ${text}`);
  const data = JSON.parse(text) as { access_token: string; expires_in?: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 };
}

export async function getLongLivedUserToken(shortToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: requireEnv("META_APP_ID"),
    client_secret: requireEnv("META_APP_SECRET"),
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

// ─── Discovery ────────────────────────────────────────────────────

/**
 * Walk the user's Pages, find one linked to an Instagram Business account.
 * Returns the IG account info plus the Page-scoped token (which lives as
 * long as the user token but is what the IG endpoints actually require).
 *
 * If multiple Pages have linked IG accounts, returns the first one.
 */
export async function findInstagramAccount(userToken: string): Promise<IgAccount | null> {
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

    // Fetch the IG username for display.
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
      // Page tokens issued from a long-lived user token are themselves
      // long-lived (effectively non-expiring as long as the user token
      // is alive). We still store an upper bound for safety.
      pageTokenExpiresAt: null,
    };
  }

  return null;
}

// ─── Token refresh ────────────────────────────────────────────────

/**
 * Refresh a long-lived user token. Long-lived tokens auto-extend each time
 * you call any Graph API endpoint with them, but we can also explicitly
 * exchange the current one for a fresh 60-day token before it expires.
 */
export async function refreshLongLivedToken(currentToken: string) {
  return getLongLivedUserToken(currentToken);
}

// ─── Publishing ────────────────────────────────────────────────────

export type PublishOpts = {
  igUserId: string;
  pageAccessToken: string;
  imageUrls: string[];
  caption: string;
  format: "single" | "carousel" | "story" | "case-study";
};

export async function publishToInstagram(opts: PublishOpts): Promise<string> {
  const { igUserId, pageAccessToken, imageUrls, caption, format } = opts;
  if (imageUrls.length === 0) throw new Error("No images to publish");

  // Stories: media_type=STORIES, single image only. If you pass a carousel
  // post here we just publish the first slide as a story (rare path).
  if (format === "story") {
    const containerId = await createMediaContainer(igUserId, pageAccessToken, {
      image_url: imageUrls[0],
      media_type: "STORIES",
    });
    return finalizeContainer(igUserId, pageAccessToken, containerId);
  }

  // Single feed image (or single-slide post that the user labelled differently).
  if (format === "single" || imageUrls.length === 1) {
    const containerId = await createMediaContainer(igUserId, pageAccessToken, {
      image_url: imageUrls[0],
      caption,
    });
    return finalizeContainer(igUserId, pageAccessToken, containerId);
  }

  // Carousel: 2-10 children. Build each as is_carousel_item, then a parent
  // CAROUSEL container with their ids. IG enforces 2-10 children.
  const slides = imageUrls.slice(0, 10);
  const childIds: string[] = [];
  for (const url of slides) {
    const id = await createMediaContainer(igUserId, pageAccessToken, {
      image_url: url,
      is_carousel_item: "true",
    });
    childIds.push(id);
  }
  const parentId = await createMediaContainer(igUserId, pageAccessToken, {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
  });
  return finalizeContainer(igUserId, pageAccessToken, parentId);
}

async function createMediaContainer(
  igUserId: string,
  token: string,
  fields: Record<string, string>,
): Promise<string> {
  const body = new URLSearchParams({ ...fields, access_token: token });
  const res = await fetch(`${FB_API_BASE}/${igUserId}/media`, {
    method: "POST",
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Create container failed: ${text}`);
  const data = JSON.parse(text) as { id: string };
  return data.id;
}

/** Wait for the container to finish processing, then publish. */
async function finalizeContainer(
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
  const data = JSON.parse(text) as { id: string };
  return data.id;
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
      const t = await res.text();
      throw new Error(`Status check failed: ${t}`);
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
