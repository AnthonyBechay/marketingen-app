// Tiny HMAC helper for OAuth state — proves the callback's `state` param
// originated from us and binds it to a specific user + project + provider.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SocialProvider } from "@prisma/client";

function secret() {
  const s = process.env.SESSION_SECRET || process.env.META_APP_SECRET || "";
  if (!s) throw new Error("SESSION_SECRET (or META_APP_SECRET) is required for OAuth state signing");
  return s;
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
