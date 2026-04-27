"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { r2KeyForLogo, uploadObject } from "@/lib/r2";

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
  logoImageUrl: z.string().url().nullable().optional(),
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

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

function extFromMime(mime: string): string {
  if (mime === "image/svg+xml") return "svg";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "png";
}

/**
 * Upload a logo file to R2 and update the project's brand record.
 * Returns the new public URL on success.
 */
export async function uploadLogoAction(slug: string, formData: FormData) {
  const { user, project } = await requireProject(slug);
  const file = formData.get("logo");
  if (!(file instanceof File)) return { error: "No file provided" };
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: `Unsupported file type: ${file.type}. Use PNG, JPG, SVG, or WebP.` };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: `File too large (max ${MAX_LOGO_BYTES / 1024 / 1024} MB).` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = r2KeyForLogo(user.id, project.id, extFromMime(file.type));
  const url = await uploadObject(key, buffer, file.type, "public, max-age=86400");

  await db.brand.update({
    where: { projectId: project.id },
    data: { logoImageUrl: url },
  });

  revalidatePath(`/app/${slug}/brand`);
  return { ok: true, url };
}

/** Clear the uploaded logo so the inline SVG is used again. */
export async function removeLogoAction(slug: string) {
  const { project } = await requireProject(slug);
  await db.brand.update({
    where: { projectId: project.id },
    data: { logoImageUrl: null },
  });
  revalidatePath(`/app/${slug}/brand`);
  return { ok: true };
}
