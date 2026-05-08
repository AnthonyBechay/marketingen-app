// Resolves OAuth app credentials for a provider. Looks at the DB-stored
// OAuthApp row first (admin-managed) and falls back to env vars so
// existing single-tenant setups keep working without a UI step.
//
// All provider OAuth code goes through these helpers — no provider should
// touch process.env directly anymore.

import type { SocialProvider } from "@prisma/client";
import { db } from "../db";

export type OAuthCreds = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

const ENV_FALLBACK: Record<SocialProvider, () => Partial<OAuthCreds>> = {
  // Instagram uses the Instagram Business Login flow — these are the
  // *Instagram* App ID + Secret from the Meta dashboard's "API setup with
  // Instagram business login" panel, not the parent Meta App credentials.
  instagram: () => ({
    clientId: process.env.INSTAGRAM_APP_ID,
    clientSecret: process.env.INSTAGRAM_APP_SECRET,
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI,
  }),
  linkedin: () => ({
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI,
  }),
};

/** Fetch credentials, throwing if missing. Use inside provider OAuth code. */
export async function getCreds(provider: SocialProvider): Promise<OAuthCreds> {
  const got = await tryGetCreds(provider);
  if (!got) {
    throw new Error(
      `${provider} OAuth credentials are not configured. An admin must add them under Settings → OAuth apps.`,
    );
  }
  return got;
}

/** Returns credentials if configured, else null. Used by `providerEnabled`. */
export async function tryGetCreds(provider: SocialProvider): Promise<OAuthCreds | null> {
  const row = await db.oAuthApp.findUnique({ where: { provider } }).catch(() => null);
  if (row) {
    return {
      clientId: row.clientId,
      clientSecret: row.clientSecret,
      redirectUri: row.redirectUri,
    };
  }
  const env = ENV_FALLBACK[provider]();
  if (env.clientId && env.clientSecret && env.redirectUri) {
    return env as OAuthCreds;
  }
  return null;
}

/**
 * Synchronous, env-only check. Used by code paths that aren't async-friendly
 * (rare). Prefer `providerEnabled` async version where possible.
 */
export function providerEnabledFromEnv(provider: SocialProvider): boolean {
  const env = ENV_FALLBACK[provider]();
  return Boolean(env.clientId && env.clientSecret && env.redirectUri);
}
