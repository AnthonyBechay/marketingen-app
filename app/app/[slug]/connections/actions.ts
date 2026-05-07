"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma, SocialProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { rollupPostStatus } from "@/lib/publish-post";

const labelSchema = z.string().max(60);

export async function updateConnectionLabelAction(
  slug: string,
  provider: SocialProvider,
  customLabel: string,
) {
  const { project } = await requireProject(slug);
  const parsed = labelSchema.safeParse(customLabel);
  if (!parsed.success) return { error: "Label too long (max 60 chars)" };

  await db.socialConnection.updateMany({
    where: { projectId: project.id, provider },
    data: { customLabel: parsed.data.trim() || null },
  });

  revalidatePath(`/app/${slug}/connections`);
  revalidatePath(`/app/${slug}`);
  return { ok: true };
}

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

/**
 * Change the LinkedIn "post as" identity. The author URN must be either the
 * connection's personal urn or one of the admin'd organization URNs stored
 * in connection.meta.organizations — we validate against that list to avoid
 * the user pasting an arbitrary urn the token can't actually post to.
 */
export async function setLinkedInAuthorAction(slug: string, authorUrn: string) {
  const { project } = await requireProject(slug);
  const conn = await db.socialConnection.findUnique({
    where: { projectId_provider: { projectId: project.id, provider: "linkedin" } },
  });
  if (!conn) return { error: "LinkedIn is not connected" };

  const meta = (conn.meta as Record<string, unknown>) ?? {};
  const personUrn = (meta.personUrn as string | undefined) ?? `urn:li:person:${conn.accountId}`;
  const orgs = (meta.organizations as Array<{ urn: string }> | undefined) ?? [];
  const allowed = new Set<string>([personUrn, ...orgs.map((o) => o.urn)]);
  if (!allowed.has(authorUrn)) {
    return { error: "Selected author is not on this connection's allowlist" };
  }

  await db.socialConnection.update({
    where: { id: conn.id },
    data: { meta: { ...meta, authorUrn } as Prisma.InputJsonValue },
  });

  revalidatePath(`/app/${slug}/connections`);
  revalidatePath(`/app/${slug}`);
  return { ok: true };
}
