"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { r2, deleteKeys, r2KeyPrefixForPost, r2Bucket } from "@/lib/r2";

export async function setPostStatusAction(
  slug: string,
  postId: string,
  status: "draft" | "posted" | "archived"
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
  const { project } = await requireProject(slug);
  const post = await db.post.findFirst({ where: { id: postId, projectId: project.id } });
  if (!post) return { error: "Not found" };

  // Best-effort delete from R2.
  try {
    const prefix = r2KeyPrefixForPost(project.id, post.name);
    const list = await r2().send(new ListObjectsV2Command({ Bucket: r2Bucket(), Prefix: prefix }));
    const keys = (list.Contents ?? []).map((o) => o.Key).filter((k): k is string => Boolean(k));
    if (keys.length) await deleteKeys(keys);
  } catch (e) {
    console.error("R2 cleanup failed:", e);
  }

  await db.post.delete({ where: { id: postId } });
  revalidatePath(`/app/${slug}/posts`);
  redirect(`/app/${slug}/posts`);
}
