"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { publishTargetById, rollupPostStatus } from "@/lib/publish-post";
import type { SocialProvider, TargetStatus } from "@prisma/client";

/**
 * Replace the set of channels a post targets. For each connection in
 * `connectionIds` we ensure a PostTarget row exists; for any existing
 * target whose connection isn't in the list, we cancel it (rather than
 * delete, so we keep the publish history if it was already posted).
 */
export async function setPostTargetsAction(
  slug: string,
  postId: string,
  connectionIds: string[],
) {
  const { project } = await requireProject(slug);
  const post = await db.post.findFirst({
    where: { id: postId, projectId: project.id },
    select: { id: true },
  });
  if (!post) return { error: "Post not found" };

  const conns = await db.socialConnection.findMany({
    where: { id: { in: connectionIds }, projectId: project.id },
  });

  const existing = await db.postTarget.findMany({ where: { postId } });
  const wantedIds = new Set(conns.map((c) => c.id));

  await db.$transaction([
    // Add any new targets.
    ...conns
      .filter((c) => !existing.some((e) => e.connectionId === c.id))
      .map((c) =>
        db.postTarget.create({
          data: {
            postId,
            connectionId: c.id,
            provider: c.provider,
            status: "pending",
          },
        }),
      ),
    // Cancel removed ones (only if they haven't already been posted; posted
    // history must remain visible so the user can see what went where).
    db.postTarget.updateMany({
      where: {
        postId,
        connectionId: { notIn: Array.from(wantedIds) },
        status: { in: ["pending", "scheduled", "failed"] },
      },
      data: { status: "cancelled", scheduledFor: null },
    }),
  ]);

  await rollupPostStatus(postId);
  revalidatePath(`/app/${slug}/posts/${postId}`);
  return { ok: true };
}

/**
 * Schedule one or more targets at a specific time. Pass targetIds[] (per-channel
 * granularity) plus an ISO timestamp. The post-level status is rolled up after.
 */
export async function scheduleTargetsAction(
  slug: string,
  postId: string,
  targetIds: string[],
  scheduledForIso: string,
) {
  const { project } = await requireProject(slug);
  const dt = new Date(scheduledForIso);
  if (Number.isNaN(dt.getTime())) return { error: "Invalid date" };

  const post = await db.post.findFirst({
    where: { id: postId, projectId: project.id },
    select: { id: true },
  });
  if (!post) return { error: "Post not found" };

  await db.postTarget.updateMany({
    where: { id: { in: targetIds }, postId },
    data: { status: "scheduled", scheduledFor: dt, error: null },
  });
  await rollupPostStatus(postId);
  revalidatePath(`/app/${slug}/posts/${postId}`);
  revalidatePath(`/app/${slug}/calendar`);
  return { ok: true };
}

export async function cancelTargetAction(slug: string, postId: string, targetId: string) {
  const { project } = await requireProject(slug);
  const post = await db.post.findFirst({
    where: { id: postId, projectId: project.id },
    select: { id: true },
  });
  if (!post) return { error: "Post not found" };

  await db.postTarget.updateMany({
    where: { id: targetId, postId },
    data: { status: "cancelled", scheduledFor: null },
  });
  await rollupPostStatus(postId);
  revalidatePath(`/app/${slug}/posts/${postId}`);
  return { ok: true };
}

/**
 * Reset a cancelled or failed target back to pending so the user can
 * re-schedule or retry-publish-now without recreating the row.
 */
export async function resetTargetAction(slug: string, postId: string, targetId: string) {
  const { project } = await requireProject(slug);
  const post = await db.post.findFirst({
    where: { id: postId, projectId: project.id },
    select: { id: true },
  });
  if (!post) return { error: "Post not found" };

  await db.postTarget.updateMany({
    where: { id: targetId, postId, status: { in: ["cancelled", "failed"] } },
    data: { status: "pending", scheduledFor: null, error: null },
  });
  await rollupPostStatus(postId);
  revalidatePath(`/app/${slug}/posts/${postId}`);
  return { ok: true };
}

/**
 * Publish a single target right now (manual override). Used for the
 * per-channel "Publish now" button on the post detail view.
 */
export async function publishTargetNowAction(
  slug: string,
  postId: string,
  targetId: string,
): Promise<{ ok: true; providerPostId: string; providerUrl: string | null } | { error: string }> {
  const { project } = await requireProject(slug);
  const target = await db.postTarget.findFirst({
    where: { id: targetId, postId, post: { projectId: project.id } },
    select: { id: true },
  });
  if (!target) return { error: "Target not found" };

  const result = await publishTargetById(targetId);
  revalidatePath(`/app/${slug}/posts/${postId}`);
  revalidatePath(`/app/${slug}/posts`);
  if (result.ok) {
    return { ok: true, providerPostId: result.providerPostId, providerUrl: result.providerUrl };
  }
  return { error: result.error };
}

/**
 * Top-level post status changes that aren't per-target — cancel the whole
 * post, archive it, mark draft. Per-channel state is updated to match.
 */
export async function setPostLifecycleAction(
  slug: string,
  postId: string,
  status: "draft" | "cancelled" | "archived",
) {
  const { project } = await requireProject(slug);
  const post = await db.post.findFirst({
    where: { id: postId, projectId: project.id },
    select: { id: true },
  });
  if (!post) return { error: "Post not found" };

  if (status === "cancelled" || status === "archived") {
    await db.$transaction([
      db.postTarget.updateMany({
        where: { postId, status: { in: ["pending", "scheduled", "failed"] } },
        data: { status: "cancelled", scheduledFor: null },
      }),
      db.post.update({
        where: { id: postId },
        data: { status, scheduledFor: null },
      }),
    ]);
  } else {
    // draft: reactivate cancelled targets to pending.
    await db.$transaction([
      db.postTarget.updateMany({
        where: { postId, status: "cancelled" },
        data: { status: "pending", scheduledFor: null, error: null },
      }),
      db.post.update({ where: { id: postId }, data: { status: "draft" } }),
    ]);
  }

  revalidatePath(`/app/${slug}/posts/${postId}`);
  revalidatePath(`/app/${slug}/posts`);
  return { ok: true };
}

// Re-exported provider type so client components don't import @prisma/client.
export type { SocialProvider, TargetStatus };
