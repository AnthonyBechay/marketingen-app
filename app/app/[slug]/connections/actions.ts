"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import type { SocialProvider } from "@prisma/client";
import { rollupPostStatus } from "@/lib/publish-post";

export async function disconnectAction(slug: string, provider: SocialProvider) {
  const { project } = await requireProject(slug);
  const conn = await db.socialConnection.findUnique({
    where: { projectId_provider: { projectId: project.id, provider } },
    select: { id: true },
  });
  if (!conn) return { ok: true };

  // Cancel any scheduled targets that point to this connection so the cron
  // worker doesn't try to publish via a now-disconnected account.
  const affectedTargets = await db.postTarget.findMany({
    where: { connectionId: conn.id, status: { in: ["scheduled", "pending", "failed"] } },
    select: { id: true, postId: true },
  });

  await db.$transaction([
    db.postTarget.updateMany({
      where: { id: { in: affectedTargets.map((t) => t.id) } },
      data: { status: "cancelled" },
    }),
    db.socialConnection.delete({ where: { id: conn.id } }),
  ]);

  // Recompute Post.status for any post whose targets we just cancelled.
  const postIds = Array.from(new Set(affectedTargets.map((t) => t.postId)));
  for (const id of postIds) await rollupPostStatus(id);

  revalidatePath(`/app/${slug}/connections`);
  revalidatePath(`/app/${slug}`);
  return { ok: true };
}
