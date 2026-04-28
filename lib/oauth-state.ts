// Tiny HMAC helper for OAuth state — proves the callback's `state` param
// originated from us and bind it to a specific user + project.
import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const s = process.env.SESSION_SECRET || process.env.META_APP_SECRET || "";
  if (!s) throw new Error("SESSION_SECRET (or META_APP_SECRET) is required for OAuth state signing");
  return s;
}

export function signState(payload: { userId: string; projectId: string }): string {
  const data = `${payload.userId}.${payload.projectId}.${Date.now()}`;
  const sig = createHmac("sha256", secret()).update(data).digest("hex").slice(0, 24);
  // Base64url so it survives URL transit cleanly.
  return Buffer.from(`${data}.${sig}`).toString("base64url");
}

export function verifyState(state: string, maxAgeMs = 10 * 60 * 1000): {
  userId: string;
  projectId: string;
} | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 4) return null;
    const [userId, projectId, ts, sig] = parts;
    const expected = createHmac("sha256", secret())
      .update(`${userId}.${projectId}.${ts}`)
      .digest("hex")
      .slice(0, 24);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Date.now() - Number(ts) > maxAgeMs) return null;
    return { userId, projectId };
  } catch {
    return null;
  }
}
