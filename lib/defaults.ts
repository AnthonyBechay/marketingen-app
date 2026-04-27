// Default values when a new project is created.
// All values are intentionally NEUTRAL — no bechai-specific branding.
// Users fill these in via the Brand editor (or click "Seed bechai.ai"
// if they're the admin).

import type { Prisma } from "@prisma/client";

/**
 * Generate a placeholder SVG monogram from the project name's first letter.
 * Renders as a rounded dark square with a single white initial — works as a
 * functional logo until the user uploads or pastes their real one.
 */
export function placeholderLogoSvg(projectName: string): string {
  const letter = (projectName.trim()[0] || "M").toUpperCase();
  return `<svg width="{size}" height="{size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="6" fill="#1e293b"/>
  <text x="16" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="16" font-weight="700" text-anchor="middle" fill="white">${letter}</text>
</svg>`;
}

export const NEUTRAL_COLORS = {
  bg: "#0f172a",        // slate-900 — neutral dark
  primary: "#3b82f6",   // blue-500 — generic accent
  secondary: "#64748b", // slate-500 — neutral second accent
  alert: "#ef4444",
  text: "#ffffff",
  muted: "#94a3b8",     // slate-400
  dim: "#64748b",
};

export const NEUTRAL_FONTS = {
  sans: "Inter",
  mono: "JetBrains Mono",
  googleFontsUrl:
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
};

export function defaultBrand(name: string): Prisma.BrandUncheckedCreateWithoutProjectInput {
  // Logo text uses the project name as a sensible starting word, but the
  // user can split it into "before / highlight / after" however they like.
  const cleaned = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    name,
    tagline: "",
    domain: "",
    logoSvg: placeholderLogoSvg(name),
    logoImageUrl: null,
    logoTextBefore: cleaned || "your",
    logoTextHighlight: "",
    logoTextAfter: "",
    colors: NEUTRAL_COLORS,
    fonts: NEUTRAL_FONTS,
    voice: "",
    audience: "",
    anchors: {},
    hashtagPool: [],
    ctaDefault: "Learn more →",
  };
}

export function defaultCampaign(): Prisma.CampaignUncheckedCreateWithoutProjectInput {
  return {
    name: "",
    goal: "",
    audience: "",
    frequency: "3 posts/week",
    formatMix:
      "Roughly: 60% carousels for value/education, 25% single-image stories for hooks, 15% case studies.",
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
