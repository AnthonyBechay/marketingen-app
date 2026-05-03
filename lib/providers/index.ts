// Provider registry. To add a new social network, write an adapter that
// implements SocialProviderImpl and register it here.

import type { SocialProvider as ProviderEnum } from "@prisma/client";
import { instagramProvider } from "./instagram";
import { linkedinProvider } from "./linkedin";
import { tryGetCreds } from "./credentials";
import type { SocialProviderImpl } from "./types";

export const providers: Record<ProviderEnum, SocialProviderImpl> = {
  instagram: instagramProvider,
  linkedin: linkedinProvider,
};

export const PROVIDER_LIST: ProviderEnum[] = ["instagram", "linkedin"];

export function getProvider(id: ProviderEnum): SocialProviderImpl {
  const p = providers[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

/**
 * A provider is "enabled" when its OAuth credentials are configured —
 * either in the OAuthApp DB row (admin-managed) or via env vars (legacy).
 * Async because the DB lookup is async.
 */
export async function providerEnabled(id: ProviderEnum): Promise<boolean> {
  const creds = await tryGetCreds(id);
  return creds !== null;
}

export type { SocialProviderImpl } from "./types";
