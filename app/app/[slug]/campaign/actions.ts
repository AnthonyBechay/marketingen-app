"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { anthropic, ANTHROPIC_MODEL, extractJson } from "@/lib/anthropic";

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

  const system = `You are a marketing campaign strategist. Given a brand and a brief, produce a complete first campaign for Instagram.

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

  const system = `You are an Instagram content strategist for ${brand.name}.

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
