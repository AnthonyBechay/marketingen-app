"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";

const colorsSchema = z.object({
  bg: z.string(),
  primary: z.string(),
  secondary: z.string(),
  alert: z.string(),
  text: z.string(),
  muted: z.string(),
  dim: z.string(),
});

const fontsSchema = z.object({
  sans: z.string(),
  mono: z.string(),
  googleFontsUrl: z.string(),
});

const brandSchema = z.object({
  name: z.string().min(1).max(64),
  tagline: z.string().max(200).optional(),
  domain: z.string().max(120).optional(),
  logoSvg: z.string().min(20),
  logoTextBefore: z.string().max(32),
  logoTextHighlight: z.string().max(32),
  logoTextAfter: z.string().max(32),
  colors: colorsSchema,
  fonts: fontsSchema,
  voice: z.string().max(2000),
  audience: z.string().max(2000),
  anchors: z.record(z.string(), z.string()),
  hashtagPool: z.array(z.string()).max(40),
  ctaDefault: z.string().max(80),
});

export async function saveBrandAction(slug: string, data: unknown) {
  const { project } = await requireProject(slug);
  const parsed = brandSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid brand data" };
  }
  await db.brand.update({
    where: { projectId: project.id },
    data: parsed.data,
  });
  revalidatePath(`/app/${slug}/brand`);
  return { ok: true };
}
