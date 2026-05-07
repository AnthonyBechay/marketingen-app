// LinkedIn provider adapter. Uses LinkedIn's "Sign In with LinkedIn using
// OpenID Connect" + "Share on LinkedIn" (`w_member_social`) for personal
// posting on the authenticated member's feed.
//
// Required env: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI.
//
// Publishing flow for image posts:
//   1. POST /rest/images?action=initializeUpload  → uploadUrl + image urn
//   2. PUT  uploadUrl with the image bytes
//   3. POST /rest/posts with author=urn:li:person:{sub}, content.media.id=image urn
//
// Multi-image carousels are supported via content.multiImage; PDF "carousel"
// docs are out of scope for v1. Stories are not supported by LinkedIn's
// public API. We fall back to a text + first-image post for stories.

import type { SocialConnection } from "@prisma/client";
import type {
  AccountInfo,
  PublishInput,
  PublishResult,
  SocialProviderImpl,
} from "./types";
import { getCreds } from "./credentials";

const LI_AUTH_DIALOG = "https://www.linkedin.com/oauth/v2/authorization";
const LI_TOKEN = "https://www.linkedin.com/oauth/v2/accessToken";
const LI_USERINFO = "https://api.linkedin.com/v2/userinfo";
const LI_API = "https://api.linkedin.com/rest";
// LinkedIn versions older than ~12 months get retired and reject calls
// with HTTP 426 NONEXISTENT_VERSION. Override via env when LinkedIn rotates
// without a redeploy.
const LI_API_VERSION = process.env.LINKEDIN_API_VERSION || "202508";

// Scopes:
//   openid profile email     — OIDC sign-in identity (the human)
//   w_member_social          — post to the member's own feed
//   r_organization_admin     — list Pages the member admins
//   w_organization_social    — post on those Pages' behalf
//
// `r_organization_admin` and `w_organization_social` require LinkedIn's
// "Marketing Developer Platform" product approval on the app. If your app
// doesn't have it yet, LinkedIn will silently drop those scopes and the
// connection will only be able to post personally — that's why the
// organization fetch below is wrapped in a try/catch instead of failing
// the whole OAuth.
const REQUIRED_SCOPES =
  "openid profile email w_member_social r_organization_admin w_organization_social";

type LiUserinfo = {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
};

async function fetchUserinfo(accessToken: string): Promise<LiUserinfo> {
  const res = await fetch(LI_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LinkedIn userinfo failed: ${text}`);
  return JSON.parse(text) as LiUserinfo;
}

export type LiOrganization = {
  urn: string;          // urn:li:organization:{id}
  id: string;
  name: string;
  vanityName: string | null;
};

/**
 * Fetch the Pages this access token can administer (and post on behalf of).
 * Requires `r_organization_admin` scope. Returns [] if the scope wasn't
 * granted (LinkedIn returns 403 in that case) so the caller doesn't have
 * to special-case it.
 */
async function fetchAdminOrganizations(accessToken: string): Promise<LiOrganization[]> {
  // organizationAcls returns role assignments; we filter to ADMINISTRATOR
  // role and APPROVED state, then dereference each organization to get a
  // human-friendly name.
  const aclRes = await fetch(
    `${LI_API}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "LinkedIn-Version": LI_API_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    },
  );
  if (aclRes.status === 403 || aclRes.status === 401) {
    // The app isn't approved for r_organization_admin, OR the user has no
    // org admin roles. Either way, no orgs to surface.
    return [];
  }
  const aclText = await aclRes.text();
  if (!aclRes.ok) {
    console.warn("LinkedIn organizationAcls failed:", aclText);
    return [];
  }
  const acl = JSON.parse(aclText) as {
    elements?: Array<{ organization?: string; organizationalTarget?: string }>;
  };
  const orgUrns = (acl.elements ?? [])
    .map((e) => e.organization ?? e.organizationalTarget)
    .filter((u): u is string => Boolean(u));
  if (orgUrns.length === 0) return [];

  // Fetch each org in parallel. We tolerate per-org failures.
  const orgs: LiOrganization[] = [];
  await Promise.all(
    orgUrns.map(async (urn) => {
      const id = urn.replace(/^urn:li:organization:/, "");
      try {
        const res = await fetch(
          `${LI_API}/organizations/${encodeURIComponent(id)}?fields=id,localizedName,vanityName`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "LinkedIn-Version": LI_API_VERSION,
              "X-Restli-Protocol-Version": "2.0.0",
            },
          },
        );
        if (!res.ok) return;
        const j = (await res.json()) as {
          id: number | string;
          localizedName?: string;
          vanityName?: string;
        };
        orgs.push({
          urn: `urn:li:organization:${j.id}`,
          id: String(j.id),
          name: j.localizedName ?? `Organization ${j.id}`,
          vanityName: j.vanityName ?? null,
        });
      } catch (e) {
        console.warn("LinkedIn org fetch failed:", urn, (e as Error).message);
      }
    }),
  );
  return orgs;
}

async function uploadImage(
  accessToken: string,
  authorUrn: string,
  imageUrl: string,
): Promise<string> {
  // 1. Initialize upload — get back uploadUrl + image URN.
  const initRes = await fetch(`${LI_API}/images?action=initializeUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LI_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      initializeUploadRequest: { owner: authorUrn },
    }),
  });
  const initText = await initRes.text();
  if (!initRes.ok) throw new Error(`LinkedIn image init failed: ${initText}`);
  const init = JSON.parse(initText) as {
    value: { uploadUrl: string; image: string };
  };

  // 2. Fetch the image binary from R2.
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch slide image: ${imgRes.status}`);
  }
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  // 3. PUT the bytes to LinkedIn's upload URL. No auth header on this PUT —
  // the URL is signed.
  const upRes = await fetch(init.value.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: buffer,
  });
  if (!upRes.ok) {
    throw new Error(`LinkedIn image PUT failed: ${upRes.status} ${await upRes.text()}`);
  }
  return init.value.image;
}

async function createPost(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ postUrn: string; postUrl: string | null }> {
  const res = await fetch(`${LI_API}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LI_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LinkedIn post failed: ${text}`);
  // LinkedIn returns the new urn in the x-restli-id header, NOT the body.
  const postUrn = res.headers.get("x-restli-id") ?? "";
  if (!postUrn) {
    // Some responses have the urn in the body too.
    try {
      const j = JSON.parse(text) as { id?: string };
      if (j.id) return { postUrn: j.id, postUrl: urlForUrn(j.id) };
    } catch {
      /* ignore */
    }
    throw new Error("LinkedIn post: no urn returned");
  }
  return { postUrn, postUrl: urlForUrn(postUrn) };
}

function urlForUrn(urn: string): string | null {
  // urn:li:share:1234... or urn:li:ugcPost:1234... — the share id encodes
  // the post in feed URLs as /feed/update/{urn}.
  if (!urn) return null;
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}`;
}

export const linkedinProvider: SocialProviderImpl = {
  id: "linkedin",
  meta: { name: "LinkedIn", color: "#0a66c2" },

  async oauthUrl(state: string): Promise<string> {
    const creds = await getCreds("linkedin");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: creds.clientId,
      redirect_uri: creds.redirectUri,
      state,
      scope: REQUIRED_SCOPES,
    });
    return `${LI_AUTH_DIALOG}?${params}`;
  },

  async exchangeCode(code: string): Promise<AccountInfo> {
    const creds = await getCreds("linkedin");
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: creds.redirectUri,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    });
    const res = await fetch(LI_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${text}`);
    const data = JSON.parse(text) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      refresh_token_expires_in?: number;
    };

    const userinfo = await fetchUserinfo(data.access_token);
    const personUrn = `urn:li:person:${userinfo.sub}`;
    // Best-effort fetch of admin'd Pages so the user can choose which
    // identity to post as. Failures degrade gracefully to personal-only.
    const organizations = await fetchAdminOrganizations(data.access_token).catch(() => []);

    return {
      accountId: userinfo.sub,
      accountName: userinfo.name ?? null,
      // LinkedIn doesn't expose a public @handle in userinfo — use email
      // as a stable display fallback when the name isn't enough.
      accountHandle: userinfo.email ?? null,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      meta: {
        // Default author = personal. The user can switch to a Page from the
        // Connections UI; we update meta.authorUrn there.
        authorUrn: personUrn,
        personUrn,
        personName: userinfo.name ?? null,
        picture: userinfo.picture ?? null,
        email: userinfo.email ?? null,
        organizations,
      },
    };
  },

  // LinkedIn member tokens last ~60 days. They don't auto-extend, so when
  // a refresh_token was issued (only if the app has the offline_access
  // scope, which OIDC does not include by default) we'd use it. Otherwise
  // the user must reconnect.
  async maybeRefresh(connection: SocialConnection): Promise<AccountInfo | null> {
    if (!connection.refreshToken) return null;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (
      !connection.tokenExpiresAt ||
      connection.tokenExpiresAt.getTime() - Date.now() > sevenDays
    ) {
      return null;
    }
    try {
      const creds = await getCreds("linkedin");
      const params = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connection.refreshToken,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      });
      const res = await fetch(LI_TOKEN, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      const data = JSON.parse(text) as {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
      };
      // Preserve the user's chosen authorUrn but re-fetch the list of
      // admin'd orgs since memberships can change.
      const meta = (connection.meta as Record<string, unknown>) ?? {};
      const orgs = await fetchAdminOrganizations(data.access_token).catch(() => []);
      return {
        accountId: connection.accountId,
        accountName: connection.accountName,
        accountHandle: connection.accountHandle,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? connection.refreshToken,
        tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
        meta: { ...meta, organizations: orgs },
      };
    } catch (e) {
      console.warn("LinkedIn token refresh failed:", (e as Error).message);
      return null;
    }
  },

  async publish(connection: SocialConnection, input: PublishInput): Promise<PublishResult> {
    try {
      const meta = (connection.meta as Record<string, unknown>) ?? {};
      const authorUrn =
        (meta.authorUrn as string | undefined) ?? `urn:li:person:${connection.accountId}`;
      const token = connection.accessToken;
      const { caption, imageUrls } = input;

      if (imageUrls.length === 0) {
        // Pure text post.
        const result = await createPost(token, {
          author: authorUrn,
          commentary: caption,
          visibility: "PUBLIC",
          distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        });
        return { ok: true, providerPostId: result.postUrn, providerUrl: result.postUrl };
      }

      // Single-image post (most common). Multi-image carousels could be
      // added with content.multiImage; for now we pick the first slide.
      const imageUrn = await uploadImage(token, authorUrn, imageUrls[0]);
      const result = await createPost(token, {
        author: authorUrn,
        commentary: caption,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        content: {
          media: { id: imageUrn, title: "Post image" },
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      });
      return { ok: true, providerPostId: result.postUrn, providerUrl: result.postUrl };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
};
