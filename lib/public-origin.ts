// Build a publicly-reachable origin from a request, even when the app is
// running behind a reverse proxy that gives Next.js's `req.url` the
// container's bind address (e.g. `http://0.0.0.0:3000/...`).
//
// Resolution order:
//   1. PUBLIC_URL env var      — explicit operator setting wins
//   2. x-forwarded-* headers   — what every modern proxy (Coolify,
//                                Traefik, Nginx, Caddy, Cloudflare) sets
//   3. Host header             — last resort
//
// If nothing yields a usable hostname, falls back to `req.url`'s origin
// — but we explicitly reject 0.0.0.0 so we don't hand the user a URL
// their browser can't reach.

import type { NextRequest } from "next/server";

export function publicOrigin(req: NextRequest): string {
  const fromEnv = process.env.PUBLIC_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const fwdProto =
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? "https";
  const fwdHost =
    req.headers.get("x-forwarded-host")?.split(",")[0].trim() ??
    req.headers.get("host")?.trim() ??
    "";
  if (fwdHost && !fwdHost.startsWith("0.0.0.0") && !fwdHost.startsWith("::")) {
    return `${fwdProto}://${fwdHost}`;
  }

  // Last resort. Caller probably misconfigured the proxy; we still
  // refuse to emit a 0.0.0.0 URL because browsers can't follow it.
  try {
    const u = new URL(req.url);
    if (u.hostname === "0.0.0.0" || u.hostname === "::") {
      // Better to throw than silently produce a broken redirect.
      throw new Error(
        "Public origin is unresolved — set PUBLIC_URL or configure the reverse proxy to forward x-forwarded-host.",
      );
    }
    return u.origin;
  } catch (e) {
    throw e instanceof Error ? e : new Error("Public origin is unresolved");
  }
}

/** Build an absolute URL on the public origin. `path` should start with `/`. */
export function publicUrl(req: NextRequest, path: string): URL {
  return new URL(path, publicOrigin(req));
}
