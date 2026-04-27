import { z } from "zod";
import { anthropic, ANTHROPIC_MODEL, extractJson } from "./anthropic";
import { ICON_NAMES } from "./slides";

const slideUnion = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("cover"),
    headline: z.string(),
    sub: z.string().optional(),
    badge: z.string().optional(),
    stats: z.array(z.tuple([z.string(), z.string()])).optional(),
    swipe: z.boolean().optional(),
    size: z.enum(["feed", "story"]).optional(),
  }),
  z.object({
    type: z.literal("numbered"),
    num: z.number(),
    total: z.number(),
    icon: z.string().optional(),
    accent: z.enum(["blue", "green"]).optional(),
    title: z.string(),
    desc: z.string(),
    features: z.array(z.string()),
  }),
  z.object({
    type: z.literal("comparison"),
    title: z.string(),
    bad_label: z.string(),
    bad_value: z.string(),
    bad_detail: z.string(),
    good_label: z.string(),
    good_value: z.string(),
    good_detail: z.string(),
  }),
  z.object({
    type: z.literal("cta"),
    headline: z.string(),
    sub: z.string().optional(),
    button: z.string().optional(),
    size: z.enum(["feed", "story"]).optional(),
  }),
  z.object({
    type: z.literal("terminal"),
    lines: z.array(z.string()),
    headline: z.string(),
    sub: z.string(),
    price_value: z.string().optional(),
    price_label: z.string().optional(),
  }),
  z.object({
    type: z.literal("case_study"),
    label: z.string(),
    headline: z.string(),
    body: z.string(),
  }),
  z.object({
    type: z.literal("feature_grid"),
    label: z.string(),
    headline: z.string(),
    stats: z.array(z.tuple([z.string(), z.string(), z.string().optional()])).optional(),
    features: z.array(z.tuple([z.string(), z.string(), z.boolean().optional()])).optional(),
    swipe: z.boolean().optional(),
  }),
]);

export const aiPostSchema = z.object({
  name: z.string().min(2).max(80),
  pillar: z.string().optional(),
  topic: z.string(),
  summary: z.string().default(""),
  format: z.string().optional(),
  caption: z.string(),
  slides: z.array(slideUnion).min(1).max(10),
});

export type AiPost = z.infer<typeof aiPostSchema>;

export type GenContext = {
  brand: {
    name: string;
    tagline?: string | null;
    voice: string;
    audience: string;
    anchors: Record<string, string>;
    hashtagPool: string[];
    ctaDefault: string;
  };
  campaign: {
    name: string;
    goal: string;
    frequency: string;
    formatMix: string;
    pillars: Array<{ name: string; description: string }>;
    toneRules: string[];
  };
  recent: Array<{ pillar: string | null; topic: string; summary: string }>;
};

function buildSystemPrompt(ctx: GenContext): string {
  const pillars = ctx.campaign.pillars.map((p) => `  - ${p.name}: ${p.description}`).join("\n");
  const tone = ctx.campaign.toneRules.map((r) => `  - ${r}`).join("\n");
  const anchors = Object.entries(ctx.brand.anchors)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  const hashtags = ctx.brand.hashtagPool.join(" ");
  const recent = ctx.recent.length
    ? ctx.recent
        .map((p) => `  - [${p.pillar ?? "?"}] ${p.topic} — ${p.summary.slice(0, 120)}`)
        .join("\n")
    : "  (none yet)";
  const cta = ctx.brand.ctaDefault;

  return `You are the marketing content generator for ${ctx.brand.name}.

ABOUT THE BRAND
${ctx.brand.name} — ${ctx.brand.tagline ?? ""}.
Audience: ${ctx.brand.audience}
Pricing anchors: ${anchors}

VOICE
${ctx.brand.voice}

CAMPAIGN
Name: ${ctx.campaign.name}
Goal: ${ctx.campaign.goal}
Frequency / format mix: ${ctx.campaign.frequency} — ${ctx.campaign.formatMix}

CONTENT PILLARS (rotate across these — don't always pick the same one):
${pillars}

TONE RULES:
${tone}

HASHTAG POOL (mix 6-10 of these per caption):
${hashtags}

DEFAULT CTA BUTTON TEXT: "${cta}"

MEMORY — RECENT POSTS (do NOT repeat these angles, slide structures, or hooks):
${recent}

OUTPUT
Return ONLY valid JSON, no markdown fences, no commentary. Schema:

{
  "name": "post-N-short-slug",
  "pillar": "one of the content pillar names above",
  "topic": "one-line topic for the campaign log",
  "summary": "2 sentences describing what this post covers (for the campaign log)",
  "format": "carousel | story | case-study",
  "caption": "Instagram caption — hook on line 1, 2-4 paragraphs, arrow CTA + hashtags. Use \\n for newlines.",
  "slides": [ <slide objects> ]
}

SLIDE TYPES

cover — opening slide with big headline.
  {"type":"cover", "headline":"Big bold headline (use <br>)", "sub":"optional", "badge":"optional like 'Just shipped'", "stats":[["$1K","Starting"]], "swipe":true, "size":"feed"}
  - size: "feed" (1080x1350) for carousels, "story" (1080x1920) for single-image posts.
  - Headline can use <span class="bl">blue</span> or <span class="gn">green</span>.

numbered — list item with icon, title, description, 3-4 features.
  {"type":"numbered", "num":1, "total":5, "icon":"calendar", "accent":"blue", "title":"...", "desc":"...", "features":["...","..."]}
  - icon: pick from [${ICON_NAMES.join(", ")}]
  - accent: alternate "blue" and "green" between slides.

comparison — bad-vs-good two-card layout.
  {"type":"comparison", "title":"The <span class=\\"bl\\">price</span> difference", "bad_label":"Other Way", "bad_value":"$15K+", "bad_detail":"...", "good_label":"${ctx.brand.name}", "good_value":"$1K", "good_detail":"..."}

cta — closing slide with big headline and a button.
  {"type":"cta", "headline":"Ready?", "sub":"...", "button":"${cta}", "size":"feed"}

terminal — fake terminal showing build process. ALWAYS story-size.
  {"type":"terminal", "lines":["<span style=\\"color:#484f58;\\">$</span> <span style=\\"color:#10b981;\\">cmd</span>"], "headline":"...", "sub":"...", "price_value":"$1K", "price_label":"starting"}

case_study — single block of body text under a label/headline.
  {"type":"case_study", "label":"The Problem", "headline":"...", "body":"... <strong style=\\"color:#fff;\\">white-bold emphasis</strong> ..."}

feature_grid — 4 stats + 4 feature tiles.
  {"type":"feature_grid", "label":"Results", "headline":"...", "stats":[["247","Items","#3b82f6"]], "features":[["Title","Description",false]]}

GUIDELINES
- Carousels: 5-8 slides. Open with cover, end with cta. Mix slide types.
- Stories: 1 slide at 1080x1920 (cover or terminal).
- Pick a content pillar that hasn't been used in the last 2-3 posts.
- Vary slide-type composition from recent posts.
- All JSON values must be valid strings — escape quotes as \\".
`;
}

export async function generateAiPost(
  idea: string,
  ctx: GenContext,
  queueMeta?: { pillar?: string | null; format?: string | null; notes?: string | null }
): Promise<AiPost> {
  let userMsg = `Topic / idea:\n\n${idea}`;
  if (queueMeta?.pillar) userMsg += `\n\nSuggested pillar: ${queueMeta.pillar}`;
  if (queueMeta?.format) userMsg += `\nSuggested format: ${queueMeta.format}`;
  if (queueMeta?.notes) userMsg += `\nNotes: ${queueMeta.notes}`;
  userMsg += "\n\nGenerate one Instagram post. Return JSON only.";

  const resp = await anthropic().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt(ctx),
    messages: [{ role: "user", content: userMsg }],
  });
  const raw = resp.content[0]?.type === "text" ? resp.content[0].text : "";
  const json = extractJson(raw);
  return aiPostSchema.parse(JSON.parse(json));
}
