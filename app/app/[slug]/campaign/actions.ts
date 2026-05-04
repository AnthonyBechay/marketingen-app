"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { anthropic, ANTHROPIC_MODEL, extractJson } from "@/lib/anthropic";
import { generateAiPost, type GenContext } from "@/lib/ai-post";
import { renderAndUploadPost } from "@/lib/render";
import { type Brand } from "@/lib/slides";
import { slugify } from "@/lib/utils";
import { rollupPostStatus } from "@/lib/publish-post";

const pillarSchema = z.object({ name: z.string(), description: z.string() });
const campaignSchema = z.object({
  name: z.string().min(1).max(120),
  goal: z.string().max(2000),
  audience: z.string().max(2000),
  frequency: z.string().max(80),
  formatMix: z.string().max(800),
  pillars: z.array(pillarSchema).max(20),
  toneRules: z.array(z.string().max(300)).max(20),
});

export async function saveCampaignAction(slug: string, data: unknown) {
  const { project } = await requireProject(slug);
  const parsed = campaignSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid campaign data" };
  await db.campaign.update({ where: { projectId: project.id }, data: parsed.data });
  revalidatePath(`/app/${slug}/campaign`);
  return { ok: true };
}

const queueItemSchema = z.object({
  topic: z.string().min(2).max(300),
  pillar: z.string().max(60).optional(),
  format: z.string().max(40).optional(),
  notes: z.string().max(1000).optional(),
});

export async function addQueueItemAction(slug: string, data: unknown) {
  const { project } = await requireProject(slug);
  const parsed = queueItemSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid queue item" };
  const max = await db.queueItem.aggregate({
    where: { projectId: project.id },
    _max: { position: true },
  });
  await db.queueItem.create({
    data: { projectId: project.id, position: (max._max.position ?? 0) + 1, ...parsed.data },
  });
  revalidatePath(`/app/${slug}/campaign`);
  return { ok: true };
}

export async function updateQueueItemAction(slug: string, id: string, data: unknown) {
  const { project } = await requireProject(slug);
  const parsed = queueItemSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid queue item" };
  await db.queueItem.updateMany({
    where: { id, projectId: project.id },
    data: parsed.data,
  });
  revalidatePath(`/app/${slug}/campaign`);
  return { ok: true };
}

export async function deleteQueueItemAction(slug: string, id: string) {
  const { project } = await requireProject(slug);
  await db.queueItem.deleteMany({ where: { id, projectId: project.id } });
  revalidatePath(`/app/${slug}/campaign`);
  return { ok: true };
}

/** Move a queue item one slot up or down by swapping positions with its neighbor. */
export async function moveQueueItemAction(slug: string, id: string, direction: "up" | "down") {
  const { project } = await requireProject(slug);
  const items = await db.queueItem.findMany({
    where: { projectId: project.id },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return { error: "Item not found" };
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= items.length) return { ok: true }; // already at edge

  const a = items[idx];
  const b = items[swapIdx];
  await db.$transaction([
    db.queueItem.update({ where: { id: a.id }, data: { position: b.position } }),
    db.queueItem.update({ where: { id: b.id }, data: { position: a.position } }),
  ]);
  revalidatePath(`/app/${slug}/campaign`);
  return { ok: true };
}

export async function reorderQueueAction(slug: string, ids: string[]) {
  const { project } = await requireProject(slug);
  await db.$transaction(
    ids.map((id, i) =>
      db.queueItem.updateMany({
        where: { id, projectId: project.id },
        data: { position: i },
      })
    )
  );
  revalidatePath(`/app/${slug}/campaign`);
  return { ok: true };
}

// AI campaign helper — builds pillars + queue from a brief.
const aiCampaignSchema = z.object({
  name: z.string(),
  goal: z.string(),
  audience: z.string(),
  frequency: z.string(),
  formatMix: z.string(),
  pillars: z.array(z.object({ name: z.string(), description: z.string() })),
  toneRules: z.array(z.string()),
  queue: z.array(
    z.object({
      topic: z.string(),
      pillar: z.string().optional(),
      format: z.string().optional(),
      notes: z.string().optional(),
    })
  ),
});

export async function aiBuildCampaignAction(slug: string, brief: string) {
  const { project } = await requireProject(slug);
  const brand = await db.brand.findUnique({ where: { projectId: project.id } });
  if (!brand) return { error: "Brand not found" };

  const system = `You are a marketing campaign strategist. Given a brand and a brief, produce a complete first social media campaign (Instagram + LinkedIn).

BRAND
Name: ${brand.name}
Tagline: ${brand.tagline ?? ""}
Voice: ${brand.voice}
Audience: ${brand.audience}
Pricing anchors: ${JSON.stringify(brand.anchors)}

OUTPUT
Return ONLY valid JSON, no markdown fences, no commentary. Schema:
{
  "name": "campaign name",
  "goal": "1-2 sentence goal",
  "audience": "who this is for in detail",
  "frequency": "e.g. 3 posts/week",
  "formatMix": "rough breakdown of carousel/story/case-study mix",
  "pillars": [
    {"name": "Value", "description": "..."},
    ... 4-6 pillars
  ],
  "toneRules": [
    "Open with a hook, not a greeting",
    ... 4-6 rules
  ],
  "queue": [
    {"topic": "specific post idea", "pillar": "matching pillar name", "format": "carousel|story|case-study", "notes": "..."},
    ... 8-12 ideas, ordered roughly in posting order
  ]
}

Make the queue concrete and specific to the brand and brief — not generic.`;

  const msg = await anthropic().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: `Brief:\n\n${brief}\n\nGenerate the full campaign JSON.` }],
  });
  const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  let parsed;
  try {
    parsed = aiCampaignSchema.parse(JSON.parse(extractJson(raw)));
  } catch (e) {
    return { error: `Could not parse AI response: ${(e as Error).message}` };
  }

  await db.$transaction([
    db.campaign.update({
      where: { projectId: project.id },
      data: {
        name: parsed.name,
        goal: parsed.goal,
        audience: parsed.audience,
        frequency: parsed.frequency,
        formatMix: parsed.formatMix,
        pillars: parsed.pillars,
        toneRules: parsed.toneRules,
      },
    }),
    db.queueItem.deleteMany({ where: { projectId: project.id } }),
    ...parsed.queue.map((item, i) =>
      db.queueItem.create({
        data: { projectId: project.id, position: i, ...item },
      })
    ),
  ]);

  revalidatePath(`/app/${slug}/campaign`);
  return { ok: true, count: parsed.queue.length };
}

// ─── AI continuity helper — extends the queue with new ideas ───────
//
// Reads brand + campaign + ALL published posts + remaining queue, and asks
// Claude to propose N new ideas that:
//   - match the brand voice and pillars
//   - extend / build continuity with what's already been posted
//   - DON'T repeat existing topics in the queue or in published history
//
// Appended to the bottom of the queue (positions after the current max).

const aiSuggestSchema = z.object({
  ideas: z.array(
    z.object({
      topic: z.string(),
      pillar: z.string().optional(),
      format: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),
});

export async function aiSuggestQueueItemsAction(slug: string, count: number = 5) {
  const { project } = await requireProject(slug);
  const [brand, campaign, posts, queue] = await Promise.all([
    db.brand.findUnique({ where: { projectId: project.id } }),
    db.campaign.findUnique({ where: { projectId: project.id } }),
    db.post.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      select: { topic: true, summary: true, pillar: true, format: true, status: true },
      take: 50,
    }),
    db.queueItem.findMany({
      where: { projectId: project.id },
      orderBy: { position: "asc" },
      select: { topic: true, pillar: true },
    }),
  ]);
  if (!brand || !campaign) return { error: "Brand or campaign missing" };

  const targetCount = Math.max(1, Math.min(15, count | 0));
  const pillars = (campaign.pillars as Array<{ name: string; description: string }>) ?? [];

  const system = `You are a social content strategist for ${brand.name}.

BRAND
Voice: ${brand.voice}
Audience: ${brand.audience}
Anchors: ${JSON.stringify(brand.anchors)}

CAMPAIGN PILLARS:
${pillars.map((p) => `  - ${p.name}: ${p.description}`).join("\n")}

PUBLISHED HISTORY (${posts.length} posts — do NOT repeat these angles, but build on them):
${posts.map((p) => `  - [${p.pillar ?? "?"} / ${p.format ?? "?"} / ${p.status}] ${p.topic} — ${p.summary.slice(0, 120)}`).join("\n") || "  (none yet)"}

ALREADY IN QUEUE (don't duplicate these):
${queue.map((q) => `  - [${q.pillar ?? "?"}] ${q.topic}`).join("\n") || "  (empty)"}

TASK
Propose ${targetCount} brand-new post ideas that:
1. Build CONTINUITY with what's already published (e.g. follow-ups, deeper dives, sequels, "part 2" angles, customer-aware reactions to recent posts).
2. Rotate across content pillars proportionally — don't lean only on the most-used one.
3. Mix formats: roughly 40% carousel, 25% single (normal feed post), 25% story, 10% case-study. Use the format that fits the topic best.
4. Are concrete and specific, not generic ("5 signs your business needs X" > "Tips for businesses").

OUTPUT
Return ONLY valid JSON, no markdown fences:
{
  "ideas": [
    {"topic": "...", "pillar": "matching pillar name", "format": "carousel|single|story|case-study", "notes": "1-sentence angle/hook hint"},
    ...
  ]
}`;

  const msg = await anthropic().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: `Generate ${targetCount} new ideas. Return JSON only.` }],
  });
  const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  let parsed;
  try {
    parsed = aiSuggestSchema.parse(JSON.parse(extractJson(raw)));
  } catch (e) {
    return { error: `Could not parse AI response: ${(e as Error).message}` };
  }

  const max = await db.queueItem.aggregate({
    where: { projectId: project.id },
    _max: { position: true },
  });
  const startPos = (max._max.position ?? -1) + 1;

  await db.$transaction(
    parsed.ideas.map((item, i) =>
      db.queueItem.create({
        data: {
          projectId: project.id,
          position: startPos + i,
          topic: item.topic,
          pillar: item.pillar,
          format: item.format,
          notes: item.notes,
        },
      }),
    ),
  );

  revalidatePath(`/app/${slug}/campaign`);
  return { ok: true, count: parsed.ideas.length };
}

// ─── Fill week from queue ─────────────────────────────────────────────
//
// Walks the next N items off the queue, generates a post for each,
// renders the slides, creates a Post + targets at all currently-connected
// channels, and schedules each post on a consecutive day at the given
// time-of-day. Returns the count of posts created.

const fillWeekSchema = z.object({
  // Local-date "YYYY-MM-DD" — interpreted in the server's local TZ.
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // "HH:MM" 24h.
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/),
  count: z.number().int().min(1).max(7),
});

export async function fillWeekFromQueueAction(slug: string, input: unknown) {
  const parsed = fillWeekSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { startDate, timeOfDay, count } = parsed.data;

  const { user, project } = await requireProject(slug);
  const [brand, campaign, queue, connections, recentRows] = await Promise.all([
    db.brand.findUnique({ where: { projectId: project.id } }),
    db.campaign.findUnique({ where: { projectId: project.id } }),
    db.queueItem.findMany({
      where: { projectId: project.id },
      orderBy: { position: "asc" },
      take: count,
    }),
    db.socialConnection.findMany({ where: { projectId: project.id } }),
    db.post.findMany({
      where: { projectId: project.id, status: { not: "archived" } },
      orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      include: {
        targets: { where: { status: "posted" }, select: { provider: true } },
      },
    }),
  ]);
  const recent = recentRows.map((p) => ({
    pillar: p.pillar,
    topic: p.topic,
    summary: p.summary,
    format: p.format,
    status: p.status,
    postedAt: p.postedAt?.toISOString() ?? null,
    channels: Array.from(new Set(p.targets.map((t) => t.provider))),
  }));
  if (!brand || !campaign) return { error: "Brand or campaign missing" };
  if (queue.length === 0) return { error: "Queue is empty — add ideas first" };

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

  const [hh, mm] = timeOfDay.split(":").map(Number);
  const startParts = startDate.split("-").map(Number);
  const startD = new Date(startParts[0], startParts[1] - 1, startParts[2], hh, mm, 0, 0);

  let created = 0;
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    let post;
    try {
      post = await generateAiPost(item.topic, ctx, {
        pillar: item.pillar,
        format: item.format,
        notes: item.notes,
      });
    } catch (e) {
      console.error("fill-week: AI generation failed for", item.topic, e);
      continue;
    }

    let name = slugify(post.name) || "post";
    let n = 1;
    while (await db.post.findUnique({ where: { projectId_name: { projectId: project.id, name } } })) {
      name = `${slugify(post.name)}-${++n}`;
    }

    let urls: string[];
    try {
      urls = await renderAndUploadPost({
        brand: renderBrand,
        userId: user.id,
        projectId: project.id,
        postName: name,
        slides: post.slides,
      });
    } catch (e) {
      console.error("fill-week: render failed for", item.topic, e);
      continue;
    }

    const scheduledFor = new Date(startD);
    scheduledFor.setDate(startD.getDate() + i);

    const newPost = await db.$transaction(async (tx) => {
      const p = await tx.post.create({
        data: {
          projectId: project.id,
          name,
          topic: post.topic,
          summary: post.summary,
          pillar: post.pillar ?? item.pillar,
          format: post.format ?? item.format,
          caption: post.caption,
          slidesJson: post.slides as unknown as Prisma.InputJsonValue,
          imageUrls: urls as unknown as Prisma.InputJsonValue,
        },
      });
      // One scheduled target per connected channel.
      for (const c of connections) {
        await tx.postTarget.create({
          data: {
            postId: p.id,
            connectionId: c.id,
            provider: c.provider,
            status: "scheduled",
            scheduledFor,
          },
        });
      }
      await tx.queueItem.delete({ where: { id: item.id } });
      return p;
    });

    await rollupPostStatus(newPost.id);
    created++;
  }

  revalidatePath(`/app/${slug}/calendar`);
  revalidatePath(`/app/${slug}/posts`);
  revalidatePath(`/app/${slug}/campaign`);
  return { ok: true, count: created };
}
