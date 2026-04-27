// Full bechai.ai brand + campaign + 20-post queue. Used by the admin-only
// "Seed bechai.ai" button on /app.

export const BECHAI_LOGO_SVG = `<svg width="{size}" height="{size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" fill="#030712" rx="4"/>
  <rect x="6" y="4" width="4" height="24" rx="0.5" fill="white"/>
  <path d="M12 6 H 20 C 23.3 6 26 8.7 26 12 C 26 14.2 24.8 16 23 17" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>
  <path d="M12 26 H 20 C 23.3 26 26 23.3 26 20 C 26 18.5 25 17.5 24 17" stroke="#10b981" stroke-width="3" stroke-linecap="round"/>
  <circle cx="26" cy="12" r="1.5" fill="white"/>
  <circle cx="26" cy="20" r="1.5" fill="white"/>
</svg>`;

export const BECHAI_BRAND = {
  name: "bechai.ai",
  tagline: "We build it. We run it.",
  domain: "bechai.ai",
  logoSvg: BECHAI_LOGO_SVG,
  logoImageUrl: null,
  logoTextBefore: "bech",
  logoTextHighlight: "ai",
  logoTextAfter: ".ai",
  colors: {
    bg: "#030712",
    primary: "#3b82f6",
    secondary: "#10b981",
    alert: "#ef4444",
    text: "#ffffff",
    muted: "#999999",
    dim: "#666666",
  },
  fonts: {
    sans: "Plus Jakarta Sans",
    mono: "JetBrains Mono",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
  },
  voice:
    "Direct, confident, no fluff. Like a sharp technical co-founder, not a corporate consultant. Punchy lines. Use real numbers when relevant. No 'leverage synergies.' No 'we're passionate about.' Sound like someone who builds great software, not someone selling a course.",
  audience:
    "Non-technical founders, SMBs, and funded startups in Lebanon and the GCC (Dubai, Saudi, Qatar, Kuwait). Also banks and capital markets firms for fintech work.",
  anchors: {
    starting_price: "$1,000",
    delivery: "5-10 days",
    experience: "8+ years",
    products_shipped: "10+",
  },
  hashtagPool: [
    "#Lebanon",
    "#Dubai",
    "#GCC",
    "#WebApp",
    "#AI",
    "#Fintech",
    "#SmallBusiness",
    "#Startup",
    "#SaaS",
    "#Automation",
    "#WebDevelopment",
    "#bechai",
  ],
  ctaDefault: "DM me or link in bio →",
};

export const BECHAI_CAMPAIGN = {
  name: "bechai.ai launch — Q2 2026",
  goal:
    "Drive bookings from SMB founders, funded startups, and fintech teams in Lebanon and the GCC. Position bechai.ai as the fast, fair-priced product studio that ships in days.",
  audience:
    "Non-technical founders, SMB owners, and funded startup operators. Many are still running on WhatsApp groups and Excel. Some are agencies or fintech firms looking for a senior technical builder.",
  frequency: "3 posts/week",
  formatMix:
    "Roughly 60% carousels (5-8 slides) for value/education, 25% single-image stories for hooks and build-in-public, 15% case studies.",
  pillars: [
    { name: "Value", description: "What we build, transparent pricing, what's included." },
    { name: "Proof", description: "Case studies of real shipped products. Show the work." },
    { name: "Comparison", description: "Why studio > agency, why custom > template, why owning code > SaaS subscription." },
    { name: "Education", description: "Teach SMB owners and founders what's possible with modern tools and AI." },
    { name: "Behind the scenes", description: "Build-in-public, technical depth, infrastructure, how I ship fast." },
  ],
  toneRules: [
    "Open with a hook, not a greeting",
    "Use real numbers ($1,000, 5-10 days, 8+ years)",
    "No 'leverage synergies' or corporate fluff",
    "End every post with arrow CTA + 6-10 hashtags",
    "Vary slide types — don't stack 5 numbered slides without variation",
    "Mix blue and green accents across a carousel",
  ],
};

// 20 ideas, ordered roughly in posting sequence. Each is concrete, on-brand,
// and tagged with a content pillar + suggested format.
export const BECHAI_QUEUE: Array<{
  topic: string;
  pillar: string;
  format: string;
  notes?: string;
}> = [
  {
    topic: "Site relaunch — We build it. We run it.",
    pillar: "Value",
    format: "story",
    notes: "Single-image launch announcement with $1K / 5-10 day / 10+ products stats.",
  },
  {
    topic: "Built a custom web app in 2 days for $1,000",
    pillar: "Behind the scenes",
    format: "story",
    notes: "Terminal-style story showing the actual build pipeline.",
  },
  {
    topic: "5 apps every business needs in 2026",
    pillar: "Education",
    format: "carousel",
    notes: "Booking system, client portal, invoice/inventory, AI chatbot, business dashboard.",
  },
  {
    topic: "Agency vs product studio — price, time, team breakdown",
    pillar: "Comparison",
    format: "carousel",
    notes: "$15K vs $1K, 3-6mo vs 5-10 days, 20-person team vs one senior dev.",
  },
  {
    topic: "PropGroup case study — AI-powered real estate platform in 2 weeks",
    pillar: "Proof",
    format: "carousel",
    notes: "Problem, feature grid, results. AI search via Anthropic Claude.",
  },
  {
    topic: "5 signs your business is ready to automate with AI",
    pillar: "Education",
    format: "carousel",
    notes: "For SMBs running on WhatsApp + Excel.",
  },
  {
    topic: "Why I run all client apps on Hetzner, not AWS",
    pillar: "Behind the scenes",
    format: "carousel",
    notes: "Real cost savings, dedicated resources, no surprise bills. Mention live infra dashboard.",
  },
  {
    topic: "Why I don't do retainers — fixed-price projects only",
    pillar: "Value",
    format: "carousel",
    notes: "Address trust/transparency angle. Compare to agency retainer model.",
  },
  {
    topic: "Luminworth case study — personal finance platform with mobile + web",
    pillar: "Proof",
    format: "carousel",
    notes: "Use feature_grid for stats, case_study for the problem. Tag #Fintech.",
  },
  {
    topic: "What $1,000 actually gets you — full breakdown of a Rapid Build deliverable",
    pillar: "Value",
    format: "carousel",
    notes: "Counter the 'too cheap to be real' objection. List exactly what's included.",
  },
  {
    topic: "How I deploy a new client app to production in one command",
    pillar: "Behind the scenes",
    format: "story",
    notes: "Terminal single-image. Show the actual deploy command + monitoring URL.",
  },
  {
    topic: "Why owning your code beats a $99/mo SaaS subscription",
    pillar: "Comparison",
    format: "carousel",
    notes: "Lifetime cost math. Compare 5-year SaaS bill vs one-time custom build.",
  },
  {
    topic: "WealthLogs case study — invoice + inventory management in 10 days",
    pillar: "Proof",
    format: "carousel",
    notes: "Show the problem (Excel chaos) and the solution. Stats on time saved.",
  },
  {
    topic: "Murex experience — what 8 years on trading systems taught me about shipping",
    pillar: "Behind the scenes",
    format: "carousel",
    notes: "Reporting, market data, integrations. Position fintech expertise.",
  },
  {
    topic: "AI chatbot for your website — Arabic + English, trained on YOUR business",
    pillar: "Value",
    format: "carousel",
    notes: "Specific use case, GCC market angle.",
  },
  {
    topic: "From WhatsApp group to client portal — a clinic in Beirut, 6 days",
    pillar: "Proof",
    format: "carousel",
    notes: "SMB win story. Use case_study + feature_grid.",
  },
  {
    topic: "Stop paying for tools that don't fit your workflow",
    pillar: "Comparison",
    format: "carousel",
    notes: "Off-the-shelf vs custom. Examples of common tool misalignment.",
  },
  {
    topic: "How AI cut my development time by 5x — but doesn't replace experience",
    pillar: "Education",
    format: "carousel",
    notes: "Honest take on AI tooling. Position as why I can charge fairly.",
  },
  {
    topic: "Mozuk Platform case study — agency client + project management",
    pillar: "Proof",
    format: "carousel",
    notes: "Multi-tenant SaaS with role-based access.",
  },
  {
    topic: "Free 30-min call — what to expect (no pitch deck, just a conversation)",
    pillar: "Value",
    format: "carousel",
    notes: "Closing post for the campaign. Drives bookings.",
  },
];
