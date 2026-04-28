"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { r2KeyForLogo, uploadObject } from "@/lib/r2";
import { anthropic, ANTHROPIC_MODEL, extractJson } from "@/lib/anthropic";

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

// ─── AI fill brand from a vibe brief ──────────────────────────────
//
// User describes the vibe ("dark fintech, serious, electric blue accent",
// or "warm food blog, earthy, hand-crafted"). AI returns a complete
// brand-fill payload — colors, voice, audience, anchors, hashtags, CTA.
// The user chooses which sections to apply.

const aiBrandFillSchema = z.object({
  colors: z
    .object({
      bg: z.string(),
      primary: z.string(),
      secondary: z.string(),
      alert: z.string(),
      text: z.string(),
      muted: z.string(),
      dim: z.string(),
    })
    .optional(),
  voice: z.string().optional(),
  audience: z.string().optional(),
  anchors: z.record(z.string(), z.string()).optional(),
  hashtagPool: z.array(z.string()).optional(),
  ctaDefault: z.string().optional(),
  rationale: z.string().optional(),
});

export type AiBrandFill = z.infer<typeof aiBrandFillSchema>;

export async function aiFillBrandAction(
  slug: string,
  vibe: string,
): Promise<{ ok: true; data: AiBrandFill } | { error: string }> {
  if (!vibe.trim() || vibe.length > 2000) {
    return { error: "Describe the vibe (1-2000 characters)" };
  }
  const { project } = await requireProject(slug);
  const brand = await db.brand.findUnique({ where: { projectId: project.id } });
  if (!brand) return { error: "Brand not found" };

  const system = `You are a brand-identity assistant. Given a free-form vibe description for "${brand.name}", produce a complete brand-fill JSON.

OUTPUT — return ONLY valid JSON, no markdown fences:
{
  "colors": {
    "bg": "#hex (the slide background — usually dark for legibility, but match the vibe)",
    "primary": "#hex (main accent, vibrant)",
    "secondary": "#hex (second accent — picks emphasis variation)",
    "alert": "#hex (warning / bad-side. Usually red/orange)",
    "text": "#hex (text on bg — high contrast)",
    "muted": "#hex (secondary text)",
    "dim": "#hex (lowest emphasis)"
  },
  "voice": "2-4 sentence description of how the brand talks. Include things to AVOID.",
  "audience": "Who you're talking to: industry, role, region, what tools they use, what they care about.",
  "anchors": {
    "key_in_snake_case": "value with number ($1,000)",
    ...4-6 entries with concrete numbers/value props if the vibe implies them
  },
  "hashtagPool": ["#Tag1", "#Tag2", ...8-12 relevant tags mixing branded + niche + region],
  "ctaDefault": "Short button copy ending with arrow →",
  "rationale": "1-2 sentence explanation of the choices for the user"
}

Pick ONLY hex colors that work together. The bg should give 7+ contrast ratio against text. The primary/secondary pair should look intentional, not random.

If the vibe doesn't imply pricing anchors or specific hashtags, still propose sensible defaults — the user can edit.`;

  try {
    const msg = await anthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: `Vibe:\n\n${vibe}\n\nGenerate the brand fill JSON.` }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const parsed = aiBrandFillSchema.parse(JSON.parse(extractJson(raw)));
    return { ok: true, data: parsed };
  } catch (e) {
    return { error: `AI fill failed: ${(e as Error).message}` };
  }
}
