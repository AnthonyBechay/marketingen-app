// Per-target publish worker. Used by both the manual "post now" action
// and the scheduled cron route.
//
// One post can have multiple targets (one per connected social network).
// Each PostTarget tracks its own publish state, scheduledFor, attempts, and
// provider-side post id. The cron route picks `scheduled` targets whose
// scheduledFor has passed and runs them through `publishTargetById`.

import { db } from "./db";
import { getProvider } from "./providers";
import type { Post, PostTarget, Prisma, SocialConnection } from "@prisma/client";

export type PublishResult =
  | { ok: true; providerPostId: string; providerUrl: string | null }
  | { ok: false; error: string };

/**
 * Publish a single PostTarget. Loads the connection (refreshing the token
 * if it's near expiry), increments attempts, and persists the result.
 */
export async function publishTargetById(targetId: string): Promise<PublishResult> {
  const target = await db.postTarget.findUnique({
    where: { id: targetId },
    include: { post: true, connection: true },
  });
  if (!target) return { ok: false, error: "Target not found" };
  return publishTarget(target);
}

async function publishTarget(
  target: PostTarget & { post: Post; connection: SocialConnection },
): Promise<PublishResult> {
  const provider = getProvider(target.provider);
  let connection = target.connection;

  // Opportunistic token refresh.
  try {
    const refreshed = await provider.maybeRefresh?.(connection);
    if (refreshed) {
      connection = await db.socialConnection.update({
        where: { id: connection.id },
        data: {
          accountId: refreshed.accountId,
          accountName: refreshed.accountName,
          accountHandle: refreshed.accountHandle,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          tokenExpiresAt: refreshed.tokenExpiresAt,
          meta: refreshed.meta as Prisma.InputJsonValue,
        },
      });
    }
  } catch (e) {
    console.warn("Token refresh failed (continuing with existing token):", (e as Error).message);
  }

  const imageUrls = (target.post.imageUrls as string[]) ?? [];
  const caption = target.post.caption ?? "";
  const format = target.post.format;

  // Mark as publishing + bump attempts before the call so a thrown error
  // doesn't leave stale state.
  await db.postTarget.update({
    where: { id: target.id },
    data: {
      status: "publishing",
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  const result = await provider.publish(connection, { caption, imageUrls, format });

  if (result.ok) {
    await db.postTarget.update({
      where: { id: target.id },
      data: {
        status: "posted",
        postedAt: new Date(),
        providerPostId: result.providerPostId,
        providerUrl: result.providerUrl,
        error: null,
      },
    });
    await db.socialConnection.update({
      where: { id: connection.id },
      data: { lastError: null },
    });
    await rollupPostStatus(target.postId);
    return result;
  }

  const errMsg = result.error.slice(0, 1000);
  await db.postTarget.update({
    where: { id: target.id },
    data: { status: "failed", error: errMsg },
  });
  await db.socialConnection.update({
    where: { id: connection.id },
    data: { lastError: errMsg.slice(0, 500) },
  });
  await rollupPostStatus(target.postId);
  return result;
}

/**
 * Recompute the top-level Post.status / postedAt / scheduledFor from its
 * targets. Called whenever a target transitions.
 *
 * Rules:
 *   - if all non-cancelled targets are posted -> status=posted
 *   - else if any target is scheduled         -> status=scheduled
 *   - else if any target is publishing/pending -> keep current draft/scheduled
 *   - if there are no active targets at all   -> status=draft
 *
 * postedAt = earliest postedAt among posted targets
 * scheduledFor = earliest scheduledFor among scheduled targets
 */
export async function rollupPostStatus(postId: string): Promise<void> {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { status: true },
  });
  if (!post) return;
  // Cancelled/archived posts are user-driven and shouldn't be auto-rolled.
  if (post.status === "cancelled" || post.status === "archived") return;

  const targets = await db.postTarget.findMany({ where: { postId } });

  const active = targets.filter((t) => t.status !== "cancelled");
  if (active.length === 0) {
    await db.post.update({
      where: { id: postId },
      data: { status: "draft", postedAt: null, scheduledFor: null },
    });
    return;
  }

  const allPosted = active.every((t) => t.status === "posted");
  const anyScheduled = active.some((t) => t.status === "scheduled");

  const earliestPostedAt = active
    .map((t) => t.postedAt)
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const earliestScheduledFor = active
    .filter((t) => t.status === "scheduled")
    .map((t) => t.scheduledFor)
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  let nextStatus: "draft" | "scheduled" | "posted" = "draft";
  if (allPosted) nextStatus = "posted";
  else if (anyScheduled) nextStatus = "scheduled";
  // failed-only or pending-only stays as draft for the user to act on.

  await db.post.update({
    where: { id: postId },
    data: {
      status: nextStatus,
      postedAt: earliestPostedAt ?? null,
      scheduledFor: earliestScheduledFor ?? null,
    },
  });
}

/**
 * Find every scheduled target whose time has come and publish it.
 * Returns a summary suitable for the cron HTTP response.
 */
export async function publishDueTargets(now = new Date()): Promise<{
  picked: number;
  succeeded: number;
  failed: number;
  results: Array<{ targetId: string; postId: string; result: PublishResult }>;
}> {
  const due = await db.postTarget.findMany({
    where: {
      status: "scheduled",
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: "asc" },
    take: 30,
    include: { post: true, connection: true },
  });

  const results: Array<{ targetId: string; postId: string; result: PublishResult }> = [];
  let succeeded = 0;
  let failed = 0;
  for (const t of due) {
    const result = await publishTarget(t);
    results.push({ targetId: t.id, postId: t.postId, result });
    if (result.ok) succeeded++;
    else failed++;
  }
  return { picked: due.length, succeeded, failed, results };
}
