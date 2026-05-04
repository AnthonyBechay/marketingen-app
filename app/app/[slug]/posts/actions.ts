"use server";

// "use server" files may only export async functions.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { deletePrefix, postPrefix } from "@/lib/r2";

type PostStatus = "draft" | "scheduled" | "posted" | "cancelled" | "archived";

export async function setPostStatusAction(
  slug: string,
  postId: string,
  status: PostStatus,
  scheduledFor?: string | null,
) {
  const { project } = await requireProject(slug);

  // Build the patch carefully — only set scheduledFor when status === scheduled,
  // and only set postedAt when status === posted (transitioning).
  const data: {
    status: PostStatus;
    postedAt?: Date | null;
    scheduledFor?: Date | null;
  } = { status };

  if (status === "posted") {
    data.postedAt = new Date();
  } else if (status === "draft" || status === "cancelled" || status === "archived") {
    data.postedAt = null;
  }

  if (status === "scheduled") {
    if (!scheduledFor) {
      return { error: "A scheduled date is required" };
    }
    const dt = new Date(scheduledFor);
    if (Number.isNaN(dt.getTime())) {
      return { error: "Invalid scheduled date" };
    }
    data.scheduledFor = dt;
  } else {
    data.scheduledFor = null;
  }

  await db.post.updateMany({
    where: { id: postId, projectId: project.id },
    data,
  });
  revalidatePath(`/app/${slug}/posts`);
  revalidatePath(`/app/${slug}/posts/${postId}`);
  return { ok: true };
}

export async function deletePostAction(slug: string, postId: string) {
  const { user, project } = await requireProject(slug);
  const post = await db.post.findFirst({ where: { id: postId, projectId: project.id } });
  if (!post) return { error: "Not found" };

  try {
    await deletePrefix(postPrefix(user.id, project.id, post.name) + "/");
  } catch (e) {
    console.error("R2 cleanup failed:", e);
  }

  await db.post.delete({ where: { id: postId } });
  revalidatePath(`/app/${slug}/posts`);
  redirect(`/app/${slug}/posts`);
}

const captionSchema = z.string().max(8000);

export async function updatePostCaptionAction(slug: string, postId: string, caption: string) {
  const { project } = await requireProject(slug);
  const parsed = captionSchema.safeParse(caption);
  if (!parsed.success) return { error: "Caption too long (max 8000 chars)" };

  await db.post.updateMany({
    where: { id: postId, projectId: project.id },
    data: { caption: parsed.data },
  });
  revalidatePath(`/app/${slug}/posts/${postId}`);
  return { ok: true };
}

const imagesSchema = z.array(z.string().url()).max(10);

/**
 * Replace the post's image list with the given URLs (in order). Used by
 * the post detail page after the user uploads a custom photo or reorders
 * slides. The actual upload-to-R2 happens in /api/upload/post-image so
 * we can stream the multipart body directly.
 */
export async function setPostImagesAction(
  slug: string,
  postId: string,
  imageUrls: string[],
) {
  const { project } = await requireProject(slug);
  const parsed = imagesSchema.safeParse(imageUrls);
  if (!parsed.success) return { error: "Invalid image URLs" };

  await db.post.updateMany({
    where: { id: postId, projectId: project.id },
    data: { imageUrls: parsed.data as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(`/app/${slug}/posts/${postId}`);
  return { ok: true };
}
