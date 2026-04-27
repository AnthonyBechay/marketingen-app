"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { defaultBrand, defaultCampaign } from "@/lib/defaults";

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
