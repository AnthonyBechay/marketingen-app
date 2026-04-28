// Shared publish flow used by both the manual "Post now" action and the
// cron worker. Loads the connection, calls Instagram, persists the result.
//
// Returns { ok: true, mediaId } on success or { error } on failure. The
// caller is responsible for any UI side effects (toast, redirect, etc.).

import { db } from "./db";
import { publishToInstagram, refreshLongLivedToken } from "./instagram";
import type { PostStatus, Prisma } from "@prisma/client";

export type PublishResult =
  | { ok: true; mediaId: string }
  | { error: string };

export async function publishPostById(postId: string): Promise<PublishResult> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { project: { include: { instagram: true } } },
  });
  if (!post) return { error: "Post not found" };

  const connection = post.project.instagram;
  if (!connection) {
    return { error: "Instagram is not connected for this project. Connect it first." };
  }

  const imageUrls = (post.imageUrls as string[]) ?? [];
  if (imageUrls.length === 0) {
    return { error: "Post has no images" };
  }

  // Refresh the user token if it's within 7 days of expiry. Page tokens
  // derived from a long-lived user token live as long as the user token,
  // so refreshing the user token effectively keeps the page token fresh.
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (connection.tokenExpiresAt.getTime() - Date.now() < sevenDays) {
    try {
      const refreshed = await refreshLongLivedToken(connection.accessToken);
      await db.instagramConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: refreshed.accessToken,
          tokenExpiresAt: refreshed.expiresAt,
        },
      });
      connection.accessToken = refreshed.accessToken;
      connection.tokenExpiresAt = refreshed.expiresAt;
    } catch (e) {
      // Log but don't block — the existing token might still work.
      console.warn("Token refresh failed:", (e as Error).message);
    }
  }

  // Always increment attempts BEFORE the call so we record retries even
  // if the publish itself throws part-way through.
  await db.post.update({
    where: { id: post.id },
    data: {
      publishAttempts: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  try {
    const mediaId = await publishToInstagram({
      igUserId: connection.igUserId,
      pageAccessToken: connection.accessToken,
      imageUrls,
      caption: post.caption,
      format: (post.format as "single" | "carousel" | "story" | "case-study") ?? "carousel",
    });

    await db.post.update({
      where: { id: post.id },
      data: {
        status: "posted" as PostStatus,
        postedAt: new Date(),
        igMediaId: mediaId,
        publishError: null,
      },
    });

    // Clear last connection error on success.
    await db.instagramConnection.update({
      where: { id: connection.id },
      data: { lastError: null },
    });

    return { ok: true, mediaId };
  } catch (e) {
    const errMsg = (e as Error).message.slice(0, 1000);
    await db.post.update({
      where: { id: post.id },
      data: { publishError: errMsg },
    });
    await db.instagramConnection.update({
      where: { id: connection.id },
      data: { lastError: errMsg.slice(0, 500) },
    });
    return { error: errMsg };
  }
}

/**
 * Find all posts that are due for scheduled publishing and try to publish
 * each one. Used by the cron route. Returns a summary suitable for
 * logging or HTTP response.
 */
export async function publishDueScheduledPosts(now = new Date()): Promise<{
  picked: number;
  succeeded: number;
  failed: number;
  results: Array<{ postId: string; result: PublishResult }>;
}> {
  const due = await db.post.findMany({
    where: {
      status: "scheduled",
      scheduledFor: { lte: now },
    } as Prisma.PostWhereInput,
    orderBy: { scheduledFor: "asc" },
    take: 20, // sanity cap per run
    select: { id: true },
  });

  const results: Array<{ postId: string; result: PublishResult }> = [];
  let succeeded = 0;
  let failed = 0;
  for (const p of due) {
    const result = await publishPostById(p.id);
    results.push({ postId: p.id, result });
    if ("ok" in result) succeeded++;
    else failed++;
  }
  return { picked: due.length, succeeded, failed, results };
}
