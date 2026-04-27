"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { generateAiPost, type GenContext } from "@/lib/ai-post";
import { renderAndUploadPost } from "@/lib/render";
import { type Brand } from "@/lib/slides";
import { slugify } from "@/lib/utils";

async function buildContext(slug: string): Promise<{
  userId: string;
  projectId: string;
  brand: Brand;
  ctx: GenContext;
}> {
  const { user, project } = await requireProject(slug);
  const [brand, campaign, recent] = await Promise.all([
    db.brand.findUnique({ where: { projectId: project.id } }),
    db.campaign.findUnique({ where: { projectId: project.id } }),
    db.post.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { pillar: true, topic: true, summary: true },
    }),
  ]);
  if (!brand || !campaign) throw new Error("Brand or campaign missing");

  const renderBrand: Brand = {
    name: brand.name,
    logoSvg: brand.logoSvg,
    logoImageUrl: brand.logoImageUrl,
    logoTextBefore: brand.logoTextBefore,
    logoTextHighlight: brand.logoTextHighlight,
    logoTextAfter: brand.logoTextAfter,
    colors: brand.colors as Brand["colors"],
    fonts: brand.fonts as Brand["fonts"],
  };

  const ctx: GenContext = {
    brand: {
      name: brand.name,
      tagline: brand.tagline,
      voice: brand.voice,
      audience: brand.audience,
      anchors: (brand.anchors as Record<string, string>) ?? {},
      hashtagPool: (brand.hashtagPool as string[]) ?? [],
      ctaDefault: brand.ctaDefault,
    },
    campaign: {
      name: campaign.name,
      goal: campaign.goal,
      frequency: campaign.frequency,
      formatMix: campaign.formatMix,
      pillars: (campaign.pillars as Array<{ name: string; description: string }>) ?? [],
      toneRules: (campaign.toneRules as string[]) ?? [],
    },
    recent,
  };

  return { userId: user.id, projectId: project.id, brand: renderBrand, ctx };
}

async function uniqueName(projectId: string, base: string): Promise<string> {
  let name = slugify(base) || "post";
  let i = 1;
  while (await db.post.findUnique({ where: { projectId_name: { projectId, name } } })) {
    name = `${slugify(base)}-${++i}`;
  }
  return name;
}

const ideaSchema = z.string().min(3).max(2000);

export async function generateFromIdeaAction(slug: string, idea: string) {
  const parsed = ideaSchema.safeParse(idea);
  if (!parsed.success) return { error: "Topic must be 3–2000 characters" };
  const { userId, projectId, brand, ctx } = await buildContext(slug);

  let post;
  try {
    post = await generateAiPost(parsed.data, ctx);
  } catch (e) {
    return { error: `AI generation failed: ${(e as Error).message}` };
  }
  const name = await uniqueName(projectId, post.name);

  let urls: string[];
  try {
    urls = await renderAndUploadPost({ brand, userId, projectId, postName: name, slides: post.slides });
  } catch (e) {
    return { error: `Render failed: ${(e as Error).message}` };
  }

  const created = await db.post.create({
    data: {
      projectId,
      name,
      topic: post.topic,
      summary: post.summary,
      pillar: post.pillar,
      format: post.format,
      caption: post.caption,
      slidesJson: post.slides as unknown as Prisma.InputJsonValue,
      imageUrls: urls as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/app/${slug}/posts`);
  redirect(`/app/${slug}/posts/${created.id}`);
}

export async function generateFromQueueAction(slug: string) {
  const { project } = await requireProject(slug);
  const next = await db.queueItem.findFirst({
    where: { projectId: project.id },
    orderBy: { position: "asc" },
  });
  if (!next) return { error: "Queue is empty" };

  const { userId, projectId, brand, ctx } = await buildContext(slug);

  let post;
  try {
    post = await generateAiPost(
      next.topic,
      ctx,
      { pillar: next.pillar, format: next.format, notes: next.notes }
    );
  } catch (e) {
    return { error: `AI generation failed: ${(e as Error).message}` };
  }
  const name = await uniqueName(projectId, post.name);

  let urls: string[];
  try {
    urls = await renderAndUploadPost({ brand, userId, projectId, postName: name, slides: post.slides });
  } catch (e) {
    return { error: `Render failed: ${(e as Error).message}` };
  }

  const created = await db.$transaction(async (tx) => {
    const created = await tx.post.create({
      data: {
        projectId,
        name,
        topic: post.topic,
        summary: post.summary,
        pillar: post.pillar ?? next.pillar,
        format: post.format ?? next.format,
        caption: post.caption,
        slidesJson: post.slides as unknown as Prisma.InputJsonValue,
        imageUrls: urls as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.queueItem.delete({ where: { id: next.id } });
    return created;
  });

  revalidatePath(`/app/${slug}/posts`);
  revalidatePath(`/app/${slug}/campaign`);
  redirect(`/app/${slug}/posts/${created.id}`);
}
