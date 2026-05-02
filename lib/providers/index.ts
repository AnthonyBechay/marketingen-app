// Provider registry. To add a new social network, write an adapter that
// implements SocialProviderImpl and register it here.

import type { SocialProvider as ProviderEnum } from "@prisma/client";
import { instagramProvider } from "./instagram";
import { linkedinProvider } from "./linkedin";
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

export function providerEnabled(id: ProviderEnum): boolean {
  // A provider is "enabled" when its OAuth credentials are configured.
  // The Connections hub uses this to grey out unavailable providers.
  if (id === "instagram") return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  if (id === "linkedin") return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
  return false;
}

export type { SocialProviderImpl } from "./types";
