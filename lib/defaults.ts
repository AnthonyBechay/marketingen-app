// Default values when a new project is created.
import type { Prisma } from "@prisma/client";

export const DEFAULT_LOGO_SVG = `<svg width="{size}" height="{size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" fill="#030712" rx="4"/>
  <rect x="6" y="4" width="4" height="24" rx="0.5" fill="white"/>
  <path d="M12 6 H 20 C 23.3 6 26 8.7 26 12 C 26 14.2 24.8 16 23 17" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>
  <path d="M12 26 H 20 C 23.3 26 26 23.3 26 20 C 26 18.5 25 17.5 24 17" stroke="#10b981" stroke-width="3" stroke-linecap="round"/>
  <circle cx="26" cy="12" r="1.5" fill="white"/>
  <circle cx="26" cy="20" r="1.5" fill="white"/>
</svg>`;

export const DEFAULT_COLORS = {
  bg: "#030712",
  primary: "#3b82f6",
  secondary: "#10b981",
  alert: "#ef4444",
  text: "#ffffff",
  muted: "#999999",
  dim: "#666666",
};

export const DEFAULT_FONTS = {
  sans: "Plus Jakarta Sans",
  mono: "JetBrains Mono",
  googleFontsUrl:
    "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
};

export function defaultBrand(name: string): Prisma.BrandUncheckedCreateWithoutProjectInput {
  const cleanName = name.toLowerCase().replace(/\s+/g, "");
  return {
    name,
    tagline: "",
    domain: "",
    logoSvg: DEFAULT_LOGO_SVG,
    logoTextBefore: cleanName.slice(0, Math.max(1, cleanName.length - 3)) || "brand",
    logoTextHighlight: cleanName.slice(-3) || "ai",
    logoTextAfter: "",
    colors: DEFAULT_COLORS,
    fonts: DEFAULT_FONTS,
    voice:
      "Direct, confident, no fluff. Use real numbers when relevant. Sound like someone who builds great work, not someone selling a course.",
    audience: "",
    anchors: {},
    hashtagPool: ["#YourBrand"],
    ctaDefault: "DM me or link in bio →",
  };
}

export function defaultCampaign(): Prisma.CampaignUncheckedCreateWithoutProjectInput {
  return {
    name: "Launch campaign",
    goal: "",
    audience: "",
    frequency: "3 posts/week",
    formatMix:
      "Roughly: 60% carousels (5-8 slides) for value/education, 25% single-image stories for hooks, 15% case studies.",
    pillars: [
      { name: "Value", description: "What you offer. Pricing transparency." },
      { name: "Proof", description: "Case studies of real shipped work." },
      { name: "Comparison", description: "Why your approach beats the alternatives." },
      { name: "Education", description: "Teach your audience something useful." },
      { name: "Behind the scenes", description: "Process, technical depth, build-in-public." },
    ],
    toneRules: [
      "Open with a hook, not a greeting",
      "Use real numbers when relevant",
      "End every post with a clear CTA + 6-10 hashtags",
    ],
  };
}
