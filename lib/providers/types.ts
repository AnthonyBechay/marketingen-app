// Common types shared by all social providers. Each provider implements
// the SocialProvider interface; the cron worker and the per-target publish
// flow only ever talk to providers through these.

import type { SocialConnection, SocialProvider as ProviderEnum } from "@prisma/client";

export type ProviderId = ProviderEnum; // "instagram" | "linkedin"

export type ProviderMeta = {
  // Display
  name: string;          // "Instagram", "LinkedIn"
  // Used in UI for channel chips, accent colors etc.
  color: string;         // hex or tailwind class
};

export type PublishInput = {
  caption: string;
  imageUrls: string[];   // pre-rendered slide PNGs, order matters
  format: string | null; // single | carousel | story | case-study
};

export type PublishOk = {
  ok: true;
  providerPostId: string;
  providerUrl: string | null;
};
export type PublishErr = { ok: false; error: string };
export type PublishResult = PublishOk | PublishErr;

export type AccountInfo = {
  accountId: string;
  accountName: string | null;
  accountHandle: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  meta: Record<string, unknown>;
};

export interface SocialProviderImpl {
  id: ProviderId;
  meta: ProviderMeta;
  // OAuth: build the dialog URL we redirect the user to.
  oauthUrl(state: string): string;
  // OAuth: callback handler. Given the `code` from the dialog, return
  // everything we need to upsert a SocialConnection.
  exchangeCode(code: string): Promise<AccountInfo>;
  // Refresh the stored token if we can. Return null if not applicable / no-op.
  // Called opportunistically before publishing if the token is near expiry.
  maybeRefresh?(connection: SocialConnection): Promise<AccountInfo | null>;
  // Actually publish a post. The connection has been freshly loaded.
  publish(connection: SocialConnection, input: PublishInput): Promise<PublishResult>;
}
