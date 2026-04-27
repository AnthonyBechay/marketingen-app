"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { deletePrefix, postPrefix } from "@/lib/r2";

export async function setPostStatusAction(
  slug: string,
  postId: string,
  status: "draft" | "posted" | "archived",
) {
  const { project } = await requireProject(slug);
  await db.post.updateMany({
    where: { id: postId, projectId: project.id },
    data: {
      status,
      postedAt: status === "posted" ? new Date() : null,
    },
  });
  revalidatePath(`/app/${slug}/posts`);
  revalidatePath(`/app/${slug}/posts/${postId}`);
  return { ok: true };
}

export async function deletePostAction(slug: string, postId: string) {
  const { user, project } = await requireProject(slug);
  const post = await db.post.findFirst({ where: { id: postId, projectId: project.id } });
  if (!post) return { error: "Not found" };

  // Best-effort delete from R2 — uses the user-aware path prefix.
  try {
    await deletePrefix(postPrefix(user.id, project.id, post.name) + "/");
  } catch (e) {
    console.error("R2 cleanup failed:", e);
  }

  await db.post.delete({ where: { id: postId } });
  revalidatePath(`/app/${slug}/posts`);
  redirect(`/app/${slug}/posts`);
}
