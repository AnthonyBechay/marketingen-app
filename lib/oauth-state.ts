// Tiny HMAC helper for OAuth state — proves the callback's `state` param
// originated from us and binds it to a specific user + project + provider.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { SocialProvider } from "@prisma/client";

function secret() {
  const explicit = process.env.SESSION_SECRET;
  if (explicit) return explicit;
  // No explicit secret set — derive a stable one from DATABASE_URL. This
  // keeps OAuth working out of the box for self-hosted setups that haven't
  // configured SESSION_SECRET. The state token only needs to be unforgeable
  // for ~10 minutes, so even a derived value is fine.
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL must be set for OAuth state signing");
  }
  return createHash("sha256").update("oauth-state:" + dbUrl).digest("hex");
}

export type OAuthState = {
  userId: string;
  projectId: string;
  provider: SocialProvider;
};

export function signState(payload: OAuthState): string {
  const data = `${payload.userId}.${payload.projectId}.${payload.provider}.${Date.now()}`;
  const sig = createHmac("sha256", secret()).update(data).digest("hex").slice(0, 24);
  return Buffer.from(`${data}.${sig}`).toString("base64url");
}

export function verifyState(state: string, maxAgeMs = 10 * 60 * 1000): OAuthState | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 5) return null;
    const [userId, projectId, provider, ts, sig] = parts;
    const expected = createHmac("sha256", secret())
      .update(`${userId}.${projectId}.${provider}.${ts}`)
      .digest("hex")
      .slice(0, 24);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Date.now() - Number(ts) > maxAgeMs) return null;
    if (provider !== "instagram" && provider !== "linkedin") return null;
    return { userId, projectId, provider: provider as SocialProvider };
  } catch {
    return null;
  }
}
