"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { defaultBrand, defaultCampaign } from "@/lib/defaults";
import { isAdmin } from "@/lib/admin";
import { BECHAI_BRAND, BECHAI_CAMPAIGN, BECHAI_QUEUE } from "@/lib/seed-bechai";

const newProjectSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(64),
});

export async function createProjectAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();
  const parsed = newProjectSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };

  const baseSlug = slugify(parsed.data.name);
  let slug = baseSlug || "project";
  let i = 1;
  while (await db.project.findUnique({ where: { userId_slug: { userId: user.id, slug } } })) {
    slug = `${baseSlug}-${++i}`;
  }

  const project = await db.project.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      slug,
      brand: { create: defaultBrand(parsed.data.name) },
      campaign: { create: defaultCampaign() },
    },
  });

  revalidatePath("/app");
  redirect(`/app/${project.slug}`);
}

export async function deleteProjectAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id") as string;
  await db.project.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/app");
  redirect("/app");
}

/**
 * Admin-only: provisions a complete bechai.ai project with brand, campaign,
 * tone rules, and a 20-post idea queue. Idempotent: if a project with
 * slug "bechai-ai" already exists for this user, returns its slug
 * instead of creating a duplicate.
 *
 * Returns { ok, slug } on success or { error } on failure. The client
 * navigates after success — we don't `redirect()` here because button-
 * triggered server actions in Next 16 don't always honor it cleanly.
 */
export async function seedBechaiAction(): Promise<
  { ok: true; slug: string; created: boolean } | { error: string }
> {
  const user = await requireUser();
  if (!isAdmin(user.email)) {
    return { error: "Not authorized" };
  }

  const baseSlug = "bechai-ai";

  const existing = await db.project.findUnique({
    where: { userId_slug: { userId: user.id, slug: baseSlug } },
  });
  if (existing) {
    return { ok: true, slug: existing.slug, created: false };
  }

  try {
    const project = await db.project.create({
      data: {
        userId: user.id,
        name: BECHAI_BRAND.name,
        slug: baseSlug,
        brand: { create: BECHAI_BRAND },
        campaign: { create: BECHAI_CAMPAIGN },
        queueItems: {
          create: BECHAI_QUEUE.map((item, position) => ({
            topic: item.topic,
            pillar: item.pillar,
            format: item.format,
            notes: item.notes,
            position,
          })),
        },
      },
    });
    revalidatePath("/app");
    return { ok: true, slug: project.slug, created: true };
  } catch (e) {
    console.error("seedBechaiAction failed:", e);
    return { error: `Seed failed: ${(e as Error).message}` };
  }
}
