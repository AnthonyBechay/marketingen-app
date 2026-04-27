// Slide builders — TypeScript port of generate.py.
// Pure HTML strings. Each builder takes brand + slide spec and returns HTML.

export type Brand = {
  name: string;
  logoSvg: string; // contains {size} placeholder
  logoImageUrl?: string | null; // takes precedence over logoSvg if set
  logoTextBefore: string;
  logoTextHighlight: string;
  logoTextAfter: string;
  colors: {
    bg: string;
    primary: string;
    secondary: string;
    alert: string;
    text: string;
    muted: string;
    dim: string;
  };
  fonts: { sans: string; mono: string; googleFontsUrl: string };
};

/** Render the logo as either an <img> (if uploaded) or inline SVG. */
function logoMarkup(brand: Brand, size: number): string {
  if (brand.logoImageUrl) {
    return `<img src="${brand.logoImageUrl}" width="${size}" height="${size}" style="object-fit:contain;display:block;" alt="${brand.name}"/>`;
  }
  return brand.logoSvg.replace(/\{size\}/g, String(size));
}

const GRAIN =
  'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.06\'/%3E%3C/svg%3E")';

export function baseHtml(brand: Brand, body: string, w: number, h: number, padTop = 72, padBottom = 72) {
  const c = brand.colors;
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="${brand.fonts.googleFontsUrl}" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:${w}px;height:${h}px;background:${c.bg};font-family:'${brand.fonts.sans}',sans-serif;overflow:hidden;position:relative;}
body::after{content:'';position:absolute;inset:0;background:${GRAIN};pointer-events:none;z-index:1;}
.c{position:relative;z-index:2;width:100%;height:100%;display:flex;flex-direction:column;padding:${padTop}px 72px ${padBottom}px 72px;}
.orb{position:absolute;border-radius:50%;z-index:0;}
.ob{width:450px;height:450px;background:radial-gradient(circle,${c.primary}1f 0%,transparent 70%);}
.og{width:380px;height:380px;background:radial-gradient(circle,${c.secondary}1a 0%,transparent 70%);}
.lr{display:flex;align-items:center;gap:14px;margin-bottom:40px;}
.lt{font-size:24px;font-weight:700;color:${c.text};}
.lt span{color:${c.primary};}
.mn{font-family:'${brand.fonts.mono}',monospace;}
.bl{color:${c.primary};}
.gn{color:${c.secondary};}
.wh{color:${c.text};}
.dm{color:${c.dim};}
.mt{color:${c.muted};}
.sw{position:absolute;bottom:52px;right:72px;font-family:'${brand.fonts.mono}',monospace;font-size:18px;color:#444;z-index:2;}
.cb{position:absolute;bottom:72px;left:72px;right:72px;display:flex;align-items:center;justify-content:space-between;z-index:2;}
.bt{color:${c.text};font-weight:700;border-radius:14px;display:inline-flex;align-items:center;gap:8px;}
.btb{background:${c.primary};}
.dv{width:80px;height:4px;background:linear-gradient(90deg,${c.primary},${c.secondary});border-radius:2px;margin:24px 0;}
.bd{display:inline-flex;align-items:center;gap:10px;border-radius:100px;padding:10px 22px;font-family:'${brand.fonts.mono}',monospace;font-size:18px;width:fit-content;}
.bdg{background:${c.secondary}1a;border:1px solid ${c.secondary}4d;color:${c.secondary};}
.bdb{background:${c.primary}1a;border:1px solid ${c.primary}4d;color:${c.primary};}
.dot{width:10px;height:10px;border-radius:50%;}
.dotg{background:${c.secondary};}
.ck{display:flex;flex-direction:column;gap:18px;}
.ci{display:flex;align-items:center;gap:14px;font-size:24px;color:#ccc;}
.cx{width:30px;height:30px;border-radius:8px;background:${c.secondary}26;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${c.secondary};font-size:16px;}
.cd{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:36px;}
.cdg{background:${c.secondary}10;border:1px solid ${c.secondary}33;}
.cdb{background:${c.alert}0d;border:1px solid ${c.alert}26;}
</style></head><body>${body}</body></html>`;
}

function logo(brand: Brand, size = 40) {
  return `<div class="lr">${logoMarkup(brand, size)}<div class="lt">${brand.logoTextBefore}<span>${brand.logoTextHighlight}</span>${brand.logoTextAfter}</div></div>`;
}

// ─── Slide spec types ─────────────────────────────────────────
export type SlideSize = "feed" | "story";

export type CoverSlide = {
  type: "cover";
  headline: string;
  sub?: string;
  badge?: string;
  stats?: Array<[string, string]>;
  swipe?: boolean;
  size?: SlideSize;
};

export type NumberedSlide = {
  type: "numbered";
  num: number;
  total: number;
  icon?: string;
  accent?: "blue" | "green";
  title: string;
  desc: string;
  features: string[];
};

export type ComparisonSlide = {
  type: "comparison";
  title: string;
  bad_label: string;
  bad_value: string;
  bad_detail: string;
  good_label: string;
  good_value: string;
  good_detail: string;
};

export type CtaSlide = {
  type: "cta";
  headline: string;
  sub?: string;
  button?: string;
  size?: SlideSize;
};

export type TerminalSlide = {
  type: "terminal";
  lines: string[];
  headline: string;
  sub: string;
  price_value?: string;
  price_label?: string;
};

export type CaseStudySlide = {
  type: "case_study";
  label: string;
  headline: string;
  body: string;
};

export type FeatureGridSlide = {
  type: "feature_grid";
  label: string;
  headline: string;
  stats?: Array<[string, string, string?]>;
  features?: Array<[string, string, boolean?]>;
  swipe?: boolean;
};

export type Slide =
  | CoverSlide
  | NumberedSlide
  | ComparisonSlide
  | CtaSlide
  | TerminalSlide
  | CaseStudySlide
  | FeatureGridSlide;

// ─── Lucide-style icon paths ──────────────────────────────────
const ICONS: Record<string, string> = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  sparkle: '<polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9 12 2"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  trending: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  brain: '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44A2.5 2.5 0 0 1 4 17.5a2.5 2.5 0 0 1-1.98-3.04 3 3 0 0 1 .14-5.36 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 6.5 2a2.5 2.5 0 0 1 3 0Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
};

export const ICON_NAMES = Object.keys(ICONS);

// ─── Slide builders ───────────────────────────────────────────
export function renderCover(brand: Brand, s: CoverSlide): { w: number; h: number; html: string } {
  const w = 1080;
  const isStory = s.size === "story";
  const h = isStory ? 1920 : 1350;
  const c = brand.colors;

  const badgeHtml = s.badge
    ? `<div class="bd bdg" style="margin-top:16px;"><div class="dot dotg"></div>${s.badge}</div>`
    : "";

  let statsHtml = "";
  if (s.stats?.length) {
    const items = s.stats
      .map(
        ([v, l]) =>
          `<div><div style="font-size:44px;font-weight:800;color:${c.text};letter-spacing:-1px;">${v}</div><div class="mn" style="font-size:16px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">${l}</div></div>`,
      )
      .join("");
    statsHtml = `<div style="display:flex;gap:48px;margin-top:${isStory ? "48px" : "48px"};">${items}</div>`;
  }
  const subHtml = s.sub
    ? `<div class="dv"></div><div style="font-size:${isStory ? "30" : "32"}px;color:#999;line-height:1.5;max-width:800px;">${s.sub}</div>`
    : "";

  // Story uses a slightly larger headline since the canvas is taller.
  const fs = isStory ? 96 : 76;
  const sw = s.swipe !== false ? '<div class="sw">Swipe →</div>' : "";

  // STORY layout: 3-row grid (top=logo, middle=content centered, bottom=spacer)
  // FEED layout: original — content pinned to the bottom of the canvas
  const body = isStory
    ? `
    <div class="orb ob" style="top:-100px;right:-80px;"></div>
    <div class="orb og" style="bottom:150px;left:-100px;"></div>
    <div class="c" style="justify-content:space-between;">
      <div>${logo(brand)}${badgeHtml}</div>
      <div style="margin-top:auto;margin-bottom:auto;">
        <div style="font-size:${fs}px;font-weight:800;color:${c.text};line-height:1.05;letter-spacing:-3px;">${s.headline}</div>
        ${subHtml}
        ${statsHtml}
      </div>
      <div style="height:1px;"></div>
    </div>${sw}`
    : `
    <div class="orb ob" style="top:-100px;right:-80px;"></div>
    <div class="orb og" style="bottom:150px;left:-100px;"></div>
    <div class="c">${logo(brand)}${badgeHtml}
      <div style="font-size:${fs}px;font-weight:800;color:${c.text};line-height:1.08;letter-spacing:-3px;margin-top:auto;">${s.headline}</div>
      ${subHtml}${statsHtml}
      <div style="margin-bottom:${s.stats ? "80px" : "0"};"></div>
    </div>${sw}`;

  const pt = isStory ? 240 : 72;
  const pb = isStory ? 280 : 72;
  return { w, h, html: baseHtml(brand, body, w, h, pt, pb) };
}

export function renderNumbered(brand: Brand, s: NumberedSlide): { w: number; h: number; html: string } {
  const c = brand.colors;
  const accent = s.accent ?? (s.num % 2 ? "blue" : "green");
  const stroke = accent === "green" ? c.secondary : c.primary;
  const bg = `${stroke}1f`;
  const border = `${stroke}40`;
  const iconSvg = ICONS[s.icon ?? "calendar"] ?? ICONS.calendar;
  const featHtml =
    `<div class="ck" style="margin-top:auto;margin-bottom:80px;">` +
    s.features.map((f) => `<div class="ci"><div class="cx">✓</div>${f}</div>`).join("") +
    `</div>`;
  const orbClass = s.num % 2 === 0 ? "og" : "ob";
  const side = s.num % 2 === 0 ? "left" : "right";
  const num = String(s.num).padStart(2, "0");
  const total = String(s.total).padStart(2, "0");
  const body = `
    <div style="position:absolute;top:36px;right:56px;font-family:'${brand.fonts.mono}',monospace;font-size:110px;font-weight:800;color:${c.primary}0f;line-height:1;z-index:0;">${num}</div>
    <div class="orb ${orbClass}" style="top:${80 + s.num * 30}px;${side}:-100px;"></div>
    <div class="c">
      <div class="mn bl" style="font-size:18px;text-transform:uppercase;letter-spacing:3px;margin-bottom:20px;">${num} / ${total}</div>
      <div style="width:88px;height:88px;border-radius:20px;background:${bg};border:1px solid ${border};display:flex;align-items:center;justify-content:center;margin-bottom:36px;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round">${iconSvg}</svg>
      </div>
      <div style="font-size:52px;font-weight:800;color:${c.text};letter-spacing:-2px;line-height:1.15;margin-bottom:20px;">${s.title}</div>
      <div style="font-size:28px;color:#999;line-height:1.55;max-width:800px;margin-bottom:40px;">${s.desc}</div>
      ${featHtml}
    </div>
    <div class="sw">Swipe →</div>`;
  return { w: 1080, h: 1350, html: baseHtml(brand, body, 1080, 1350) };
}

export function renderComparison(brand: Brand, s: ComparisonSlide) {
  const c = brand.colors;
  const body = `
    <div class="c">
      <div style="font-size:48px;font-weight:800;color:${c.text};letter-spacing:-2px;margin-bottom:44px;">${s.title}</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:36px;justify-content:center;">
        <div class="cd cdb" style="padding:40px 44px;">
          <div class="mn" style="font-size:16px;text-transform:uppercase;letter-spacing:2px;color:${c.alert};margin-bottom:12px;">${s.bad_label}</div>
          <div style="font-size:52px;font-weight:800;color:#555;letter-spacing:-1px;line-height:1.2;">${s.bad_value}</div>
          <div style="color:#555;font-size:22px;margin-top:10px;line-height:1.5;">${s.bad_detail}</div>
        </div>
        <div class="cd cdg" style="padding:40px 44px;">
          <div class="mn" style="font-size:16px;text-transform:uppercase;letter-spacing:2px;color:${c.secondary};margin-bottom:12px;">${s.good_label}</div>
          <div style="font-size:52px;font-weight:800;color:${c.text};letter-spacing:-1px;line-height:1.2;">${s.good_value}</div>
          <div style="color:#999;font-size:22px;margin-top:10px;line-height:1.5;">${s.good_detail}</div>
        </div>
      </div>
    </div>
    <div class="sw">Swipe →</div>`;
  return { w: 1080, h: 1350, html: baseHtml(brand, body, 1080, 1350) };
}

export function renderCta(brand: Brand, s: CtaSlide) {
  const w = 1080;
  const h = s.size === "story" ? 1920 : 1350;
  const c = brand.colors;
  const button = s.button ?? "DM me or link in bio →";
  const subHtml = s.sub
    ? `<div style="font-size:28px;color:#666;line-height:1.6;margin-bottom:48px;max-width:700px;">${s.sub}</div>`
    : "";
  const body = `
    <div class="orb ob" style="top:-120px;left:50%;transform:translateX(-50%);width:500px;height:500px;"></div>
    <div class="orb og" style="bottom:-80px;right:-60px;"></div>
    <div class="c" style="justify-content:center;align-items:center;text-align:center;">
      <div style="margin-bottom:48px;">${logoMarkup(brand, 48)}</div>
      <div style="font-size:${h > 1400 ? "72" : "64"}px;font-weight:800;color:${c.text};letter-spacing:-2px;line-height:1.15;margin-bottom:24px;">${s.headline}</div>
      ${subHtml}
      <div class="bt btb" style="font-size:30px;padding:24px 56px;">${button}</div>
      <div class="mn dm" style="font-size:20px;margin-top:16px;">${brand.name}</div>
    </div>`;
  const pt = h > 1400 ? 260 : 72;
  const pb = h > 1400 ? 280 : 72;
  return { w, h, html: baseHtml(brand, body, w, h, pt, pb) };
}

export function renderTerminal(brand: Brand, s: TerminalSlide) {
  const c = brand.colors;
  const linesHtml = s.lines.join("<br>");
  const priceHtml = s.price_value
    ? `<div style="display:flex;align-items:baseline;gap:12px;margin-top:40px;">
        <span style="font-size:64px;font-weight:800;color:${c.secondary};letter-spacing:-2px;">${s.price_value}</span>
        <span class="mn" style="font-size:20px;color:#666;text-transform:uppercase;letter-spacing:1px;">${s.price_label ?? "starting at"}</span>
      </div>`
    : "";
  const body = `
    <div class="orb ob" style="bottom:80px;right:-120px;width:500px;height:500px;"></div>
    <div style="position:absolute;top:260px;left:72px;z-index:2;">${logo(brand, 36)}</div>
    <div class="c" style="justify-content:center;">
      <div style="background:#0d1117;border:1px solid #21262d;border-radius:16px;overflow:hidden;margin-bottom:48px;">
        <div style="display:flex;align-items:center;gap:8px;padding:14px 18px;background:#161b22;border-bottom:1px solid #21262d;">
          <div style="width:12px;height:12px;border-radius:50%;background:#ff5f57;"></div>
          <div style="width:12px;height:12px;border-radius:50%;background:#ffbd2e;"></div>
          <div style="width:12px;height:12px;border-radius:50%;background:#28ca41;"></div>
          <div class="mn" style="font-size:14px;color:#666;margin-left:12px;">~/project</div>
        </div>
        <div class="mn" style="padding:24px;font-size:20px;line-height:2;color:#c9d1d9;">${linesHtml}</div>
      </div>
      <div style="font-size:80px;font-weight:800;color:${c.text};line-height:1.08;letter-spacing:-3px;margin-bottom:28px;">${s.headline}</div>
      <div style="font-size:30px;color:#999;line-height:1.5;max-width:800px;">${s.sub}</div>
      ${priceHtml}
    </div>
    <div class="cb" style="bottom:300px;">
      <div class="bt btb" style="font-size:26px;padding:20px 40px;">DM me or link in bio</div>
      <div class="mn dm" style="font-size:22px;">${brand.name}</div>
    </div>`;
  return { w: 1080, h: 1920, html: baseHtml(brand, body, 1080, 1920, 260, 300) };
}

export function renderCaseStudy(brand: Brand, s: CaseStudySlide) {
  const c = brand.colors;
  const body = `
    <div class="orb ob" style="top:-80px;right:-100px;"></div>
    <div class="c">
      <div class="mn bl" style="font-size:18px;text-transform:uppercase;letter-spacing:3px;margin-bottom:16px;">${s.label}</div>
      <div style="font-size:56px;font-weight:800;color:${c.text};letter-spacing:-2px;line-height:1.12;margin-bottom:36px;">${s.headline}</div>
      <div style="font-size:30px;color:#999;line-height:1.65;max-width:850px;">${s.body}</div>
    </div>
    <div class="sw">Swipe →</div>`;
  return { w: 1080, h: 1350, html: baseHtml(brand, body, 1080, 1350) };
}

export function renderFeatureGrid(brand: Brand, s: FeatureGridSlide) {
  const c = brand.colors;
  let statsHtml = "";
  if (s.stats?.length) {
    const items = s.stats
      .map(
        ([v, l, color]) =>
          `<div class="cd" style="text-align:center;padding:32px;"><div style="font-size:48px;font-weight:800;color:${color ?? c.text};letter-spacing:-1px;">${v}</div><div class="mn" style="font-size:15px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-top:6px;">${l}</div></div>`
      )
      .join("");
    statsHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:36px;">${items}</div>`;
  }
  let featHtml = "";
  if (s.features?.length) {
    const items = s.features
      .map(
        ([t, d, hi]) =>
          `<div class="cd ${hi ? "cdg" : ""}" style="padding:28px;"><div style="font-size:22px;font-weight:700;color:${c.text};margin-bottom:6px;">${t}</div><div style="font-size:17px;color:#777;line-height:1.4;">${d}</div></div>`
      )
      .join("");
    featHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:auto;margin-bottom:20px;">${items}</div>`;
  }
  const sw = s.swipe !== false ? '<div class="sw">Swipe →</div>' : "";
  const body = `
    <div class="orb og" style="bottom:80px;left:-80px;"></div>
    <div class="c">
      <div class="mn bl" style="font-size:18px;text-transform:uppercase;letter-spacing:3px;margin-bottom:16px;">${s.label}</div>
      <div style="font-size:52px;font-weight:800;color:${c.text};letter-spacing:-2px;line-height:1.12;margin-bottom:28px;">${s.headline}</div>
      ${statsHtml}${featHtml}
    </div>${sw}`;
  return { w: 1080, h: 1350, html: baseHtml(brand, body, 1080, 1350) };
}

export function renderSlide(brand: Brand, slide: Slide): { w: number; h: number; html: string } {
  switch (slide.type) {
    case "cover":
      return renderCover(brand, slide);
    case "numbered":
      return renderNumbered(brand, slide);
    case "comparison":
      return renderComparison(brand, slide);
    case "cta":
      return renderCta(brand, slide);
    case "terminal":
      return renderTerminal(brand, slide);
    case "case_study":
      return renderCaseStudy(brand, slide);
    case "feature_grid":
      return renderFeatureGrid(brand, slide);
  }
}
