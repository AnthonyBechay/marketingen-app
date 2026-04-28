"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { publishPostById } from "@/lib/publish-post";

export async function disconnectInstagramAction(slug: string) {
  const { project } = await requireProject(slug);
  await db.instagramConnection.deleteMany({ where: { projectId: project.id } });
  revalidatePath(`/app/${slug}`);
  revalidatePath(`/app/${slug}/posts`);
  return { ok: true };
}

/**
 * Manually publish a post to Instagram NOW. Updates status to posted on
 * success or stores the error on the post record on failure.
 */
export async function publishPostNowAction(
  slug: string,
  postId: string,
): Promise<{ ok: true; mediaId: string } | { error: string }> {
  const { project } = await requireProject(slug);

  // Confirm the post belongs to this project before letting publishPostById
  // (which doesn't take a userId) touch it.
  const post = await db.post.findFirst({
    where: { id: postId, projectId: project.id },
    select: { id: true },
  });
  if (!post) return { error: "Post not found" };

  const result = await publishPostById(post.id);
  revalidatePath(`/app/${slug}/posts/${postId}`);
  revalidatePath(`/app/${slug}/posts`);
  return result;
}
