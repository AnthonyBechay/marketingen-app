"use server";

// "use server" files may only export async functions. Type aliases live in
// _types.ts (sibling) so client components can still import them.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
