"use client";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Save,
  Plus,
  X,
  Upload,
  Trash2,
  Image as ImageIcon,
  Palette,
  Type,
  Sparkles,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveBrandAction, uploadLogoAction, removeLogoAction, aiFillBrandAction, type AiBrandFill } from "./actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Wand2, Sparkles as SparklesIcon, Check } from "lucide-react";

// Curated font presets — cleaner UX than asking users for a Google Fonts URL.
const FONT_PRESETS: Record<string, { sans: string; mono: string; googleFontsUrl: string }> = {
  "Inter + JetBrains Mono": {
    sans: "Inter",
    mono: "JetBrains Mono",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
  },
  "Plus Jakarta Sans + JetBrains Mono": {
    sans: "Plus Jakarta Sans",
    mono: "JetBrains Mono",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
  },
  "Space Grotesk + JetBrains Mono": {
    sans: "Space Grotesk",
    mono: "JetBrains Mono",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
  },
  "Manrope + JetBrains Mono": {
    sans: "Manrope",
    mono: "JetBrains Mono",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
  },
  "DM Sans + DM Mono": {
    sans: "DM Sans",
    mono: "DM Mono",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700;800&display=swap",
  },
  "Outfit + IBM Plex Mono": {
    sans: "Outfit",
    mono: "IBM Plex Mono",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Outfit:wght@400;500;600;700;800&display=swap",
  },
};

const COLOR_LABELS: Record<keyof BrandData["colors"], { label: string; hint: string }> = {
  bg: { label: "Background", hint: "Slide background" },
  primary: { label: "Primary accent", hint: "Main highlight color (titles, badges)" },
  secondary: { label: "Secondary accent", hint: "Used for emphasis variation" },
  alert: { label: "Alert", hint: "Warnings + bad-side comparisons" },
  text: { label: "Text", hint: "Default text on dark backgrounds" },
  muted: { label: "Muted", hint: "Subtitle and helper text" },
  dim: { label: "Dim", hint: "Lowest-emphasis text" },
};

type BrandData = {
  name: string;
  tagline: string | null;
  domain: string | null;
  logoSvg: string;
  logoImageUrl: string | null;
  logoTextBefore: string;
  logoTextHighlight: string;
  logoTextAfter: string;
  colors: { bg: string; primary: string; secondary: string; alert: string; text: string; muted: string; dim: string };
  fonts: { sans: string; mono: string; googleFontsUrl: string };
  voice: string;
  audience: string;
  anchors: Record<string, string>;
  hashtagPool: string[];
  ctaDefault: string;
};

export function BrandForm({ slug, initial }: { slug: string; initial: BrandData }) {
  const [data, setData] = useState<BrandData>({
    ...initial,
    tagline: initial.tagline ?? "",
    domain: initial.domain ?? "",
    logoImageUrl: initial.logoImageUrl ?? null,
    anchors: initial.anchors ?? {},
    hashtagPool: initial.hashtagPool ?? [],
  });
  const [pending, startTransition] = useTransition();
  const [uploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof BrandData>(key: K, value: BrandData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function updateColor(k: keyof BrandData["colors"], v: string) {
    setData((d) => ({ ...d, colors: { ...d.colors, [k]: v } }));
  }

  function applyFontPreset(name: string) {
    const p = FONT_PRESETS[name];
    if (!p) return;
    setData((d) => ({ ...d, fonts: p }));
  }

  // Anchors as ordered key-value pairs
  const anchorEntries = Object.entries(data.anchors);
  function setAnchorAt(i: number, key: string, val: string) {
    const next = [...anchorEntries];
    next[i] = [key, val];
    update("anchors", Object.fromEntries(next.filter(([k]) => k)));
  }
  function addAnchor() {
    update("anchors", { ...data.anchors, "": "" });
  }
  function removeAnchor(i: number) {
    update("anchors", Object.fromEntries(anchorEntries.filter((_, idx) => idx !== i)));
  }

  // Hashtags
  function setHashtagAt(i: number, v: string) {
    const next = [...data.hashtagPool];
    next[i] = v.startsWith("#") || !v ? v : `#${v}`;
    update("hashtagPool", next);
  }
  function addHashtag() {
    update("hashtagPool", [...data.hashtagPool, ""]);
  }
  function removeHashtag(i: number) {
    update("hashtagPool", data.hashtagPool.filter((_, idx) => idx !== i));
  }

  function onSave() {
    startTransition(async () => {
      const cleaned = {
        ...data,
        tagline: data.tagline || undefined,
        domain: data.domain || undefined,
        hashtagPool: data.hashtagPool.filter((h) => h.trim().length > 1),
      };
      const res = await saveBrandAction(slug, cleaned);
      if (res?.error) toast.error(res.error);
      else toast.success("Brand saved");
    });
  }

  function onUploadLogo(file: File) {
    const fd = new FormData();
    fd.append("logo", file);
    startUpload(async () => {
      const res = await uploadLogoAction(slug, fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (res.url) {
        setData((d) => ({ ...d, logoImageUrl: res.url ?? null }));
        toast.success("Logo uploaded");
      }
    });
  }

  function onRemoveLogo() {
    startUpload(async () => {
      await removeLogoAction(slug);
      setData((d) => ({ ...d, logoImageUrl: null }));
      toast.success("Logo removed — using SVG fallback");
    });
  }

  const matchedFontPreset = Object.entries(FONT_PRESETS).find(
    ([, v]) => v.sans === data.fonts.sans && v.mono === data.fonts.mono,
  )?.[0];

  function applyAiFill(fill: AiBrandFill) {
    setData((d) => ({
      ...d,
      ...(fill.colors ? { colors: fill.colors } : {}),
      ...(fill.voice !== undefined ? { voice: fill.voice } : {}),
      ...(fill.audience !== undefined ? { audience: fill.audience } : {}),
      ...(fill.anchors ? { anchors: fill.anchors } : {}),
      ...(fill.hashtagPool ? { hashtagPool: fill.hashtagPool } : {}),
      ...(fill.ctaDefault !== undefined ? { ctaDefault: fill.ctaDefault } : {}),
    }));
    toast.success("Applied AI fill — review and Save brand to commit");
  }

  return (
    <div className="space-y-6">
      <AiFillBrandCard slug={slug} onApply={applyAiFill} />

      <Tabs defaultValue="identity">
        <TabsList>
          <TabsTrigger value="identity"><Sparkles className="w-3.5 h-3.5" /> Identity</TabsTrigger>
          <TabsTrigger value="logo"><ImageIcon className="w-3.5 h-3.5" /> Logo</TabsTrigger>
          <TabsTrigger value="colors"><Palette className="w-3.5 h-3.5" /> Colors</TabsTrigger>
          <TabsTrigger value="fonts"><Type className="w-3.5 h-3.5" /> Fonts</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="anchors"><DollarSign className="w-3.5 h-3.5" /> Anchors & CTA</TabsTrigger>
        </TabsList>

        {/* ─── Identity ─────────────────────────────────────────── */}
        <TabsContent value="identity">
          <Section title="Identity" subtitle="The basics — name, tagline, domain.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Brand name" hint="The display name used in slides and captions.">
                <Input value={data.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. bechai.ai" />
              </Field>
              <Field label="Domain" hint="Used in CTAs and footers (no https://).">
                <Input value={data.domain ?? ""} onChange={(e) => update("domain", e.target.value)} placeholder="e.g. bechai.ai" />
              </Field>
            </div>
            <Field label="Tagline" hint="Short line that appears in some slide layouts.">
              <Input
                value={data.tagline ?? ""}
                onChange={(e) => update("tagline", e.target.value)}
                placeholder="e.g. We build it. We run it."
              />
            </Field>
          </Section>
        </TabsContent>

        {/* ─── Logo ─────────────────────────────────────────────── */}
        <TabsContent value="logo">
          <Section
            title="Logo"
            subtitle="Upload a square PNG/JPG/SVG (max 2 MB) — or paste raw SVG markup. The uploaded image takes precedence over the SVG when both are set."
          >
            {/* Upload */}
            <div className="card-surface p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border border-border bg-secondary/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {data.logoImageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={data.logoImageUrl} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <span
                      className="w-full h-full flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: data.logoSvg.replace(/\{size\}/g, "64") }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium mb-1">
                    {data.logoImageUrl ? "Using uploaded logo" : "Using SVG fallback"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data.logoImageUrl
                      ? "The renderer will use this image on every slide."
                      : "Upload an image to replace the placeholder, or edit the SVG below."}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadLogo(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? "Uploading..." : data.logoImageUrl ? "Replace" : "Upload"}
                  </Button>
                  {data.logoImageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={onRemoveLogo}
                      disabled={uploading}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Logo text composition */}
            <Field label="Logo wordmark" hint="Text that appears next to the logo. The middle 'highlight' word renders in your primary accent color.">
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="before" value={data.logoTextBefore} onChange={(e) => update("logoTextBefore", e.target.value)} />
                <Input placeholder="highlight" value={data.logoTextHighlight} onChange={(e) => update("logoTextHighlight", e.target.value)} />
                <Input placeholder="after" value={data.logoTextAfter} onChange={(e) => update("logoTextAfter", e.target.value)} />
              </div>
              <div className="mt-2 text-sm font-mono text-muted-foreground">
                Preview:{" "}
                <span className="text-foreground font-bold">{data.logoTextBefore}</span>
                <span className="font-bold" style={{ color: data.colors.primary }}>{data.logoTextHighlight}</span>
                <span className="text-foreground font-normal">{data.logoTextAfter}</span>
              </div>
            </Field>

            {/* SVG fallback */}
            <Field label="SVG fallback" hint="Used when no image is uploaded. Use {size} placeholder for width/height.">
              <Textarea
                rows={6}
                className="font-mono text-xs"
                value={data.logoSvg}
                onChange={(e) => update("logoSvg", e.target.value)}
              />
            </Field>
          </Section>
        </TabsContent>

        {/* ─── Colors ───────────────────────────────────────────── */}
        <TabsContent value="colors">
          <Section title="Colors" subtitle="The renderer uses these to paint every slide. Click a swatch to change it.">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.keys(data.colors) as Array<keyof BrandData["colors"]>).map((k) => (
                <ColorSwatch
                  key={k}
                  label={COLOR_LABELS[k].label}
                  hint={COLOR_LABELS[k].hint}
                  value={data.colors[k]}
                  onChange={(v) => updateColor(k, v)}
                />
              ))}
            </div>
          </Section>
        </TabsContent>

        {/* ─── Fonts ────────────────────────────────────────────── */}
        <TabsContent value="fonts">
          <Section
            title="Fonts"
            subtitle="Pick a curated pair for one-click setup. The Google Fonts URL is set automatically."
          >
            <Field label="Font preset">
              <Select value={matchedFontPreset ?? "custom"} onValueChange={(v) => v !== "custom" && applyFontPreset(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a preset" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(FONT_PRESETS).map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                  <SelectItem value="custom">Custom (edit fields below)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Sans-serif font">
                <Input
                  value={data.fonts.sans}
                  onChange={(e) => setData((d) => ({ ...d, fonts: { ...d.fonts, sans: e.target.value } }))}
                  placeholder="e.g. Inter"
                />
              </Field>
              <Field label="Monospace font">
                <Input
                  value={data.fonts.mono}
                  onChange={(e) => setData((d) => ({ ...d, fonts: { ...d.fonts, mono: e.target.value } }))}
                  placeholder="e.g. JetBrains Mono"
                />
              </Field>
            </div>

            <Field label="Google Fonts URL" hint="Auto-set by presets. Override only if loading custom fonts.">
              <Input
                className="font-mono text-xs"
                value={data.fonts.googleFontsUrl}
                onChange={(e) => setData((d) => ({ ...d, fonts: { ...d.fonts, googleFontsUrl: e.target.value } }))}
              />
            </Field>
          </Section>
        </TabsContent>

        {/* ─── Voice & Audience ─────────────────────────────────── */}
        <TabsContent value="voice">
          <Section
            title="Voice & Audience"
            subtitle="Free-form. Shown to the AI before every generation so the captions match your tone."
          >
            <Field
              label="Voice"
              hint="2-4 sentences describing how you talk. Mention things to avoid (e.g. 'no corporate jargon', 'use real numbers')."
            >
              <Textarea
                rows={6}
                value={data.voice}
                onChange={(e) => update("voice", e.target.value)}
                placeholder="e.g. Direct, confident, no fluff. Use real numbers when relevant. Don't open with greetings — open with hooks."
              />
            </Field>
            <Field label="Audience" hint="Who you're talking to. Industry, role, region, what tools they use today.">
              <Textarea
                rows={4}
                value={data.audience}
                onChange={(e) => update("audience", e.target.value)}
                placeholder="e.g. SMB owners and funded startup founders in Lebanon and the GCC who still run things on WhatsApp groups and Excel."
              />
            </Field>
          </Section>
        </TabsContent>

        {/* ─── Anchors + Hashtags + CTA ────────────────────────── */}
        <TabsContent value="anchors">
          <Section
            title="Pricing anchors"
            subtitle="Key value props with numbers. The AI will weave these into captions and slides."
          >
            <div className="space-y-2">
              {anchorEntries.map(([k, v], i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-2">
                  <Input
                    placeholder="Label (e.g. starting_price)"
                    className="font-mono text-xs"
                    value={k}
                    onChange={(e) => setAnchorAt(i, e.target.value, v)}
                  />
                  <Input placeholder="Value (e.g. $1,000)" value={v} onChange={(e) => setAnchorAt(i, k, e.target.value)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeAnchor(i)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addAnchor}>
                <Plus className="w-3 h-3" /> Add anchor
              </Button>
            </div>
          </Section>

          <Section title="Hashtag pool" subtitle="The AI picks 6–10 of these per caption. Mix branded + niche + region.">
            <div className="flex flex-wrap gap-2">
              {data.hashtagPool.map((h, i) => (
                <div key={i} className="flex items-center gap-1 bg-secondary rounded-full pl-3 pr-1 py-1">
                  <input
                    value={h}
                    className="bg-transparent text-sm outline-none w-32 font-mono"
                    onChange={(e) => setHashtagAt(i, e.target.value)}
                  />
                  <button type="button" className="p-1 hover:text-destructive" onClick={() => removeHashtag(i)}>
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addHashtag}>
                <Plus className="w-3 h-3" /> Add hashtag
              </Button>
            </div>
          </Section>

          <Section title="Default CTA" subtitle="Button label used on closing slides when the AI doesn't override it.">
            <Field label="CTA text">
              <Input value={data.ctaDefault} onChange={(e) => update("ctaDefault", e.target.value)} placeholder="e.g. DM me or link in bio →" />
            </Field>
          </Section>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={onSave} disabled={pending} size="lg" className="shadow-lg">
          <Save className="w-4 h-4" /> {pending ? "Saving..." : "Save brand"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-surface p-6 space-y-4 mb-4">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ColorSwatch({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-2 bg-secondary/20">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          className="w-12 h-10 rounded-md border border-border bg-transparent cursor-pointer flex-shrink-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input className="font-mono text-xs h-9" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">{hint}</p>
    </div>
  );
}

function AiFillBrandCard({
  slug,
  onApply,
}: {
  slug: string;
  onApply: (fill: AiBrandFill) => void;
}) {
  const [open, setOpen] = useState(false);
  const [vibe, setVibe] = useState("");
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<AiBrandFill | null>(null);

  function onGenerate() {
    if (!vibe.trim()) return;
    startTransition(async () => {
      const res = await aiFillBrandAction(slug, vibe);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setPreview(res.data);
    });
  }

  function onConfirmApply() {
    if (!preview) return;
    onApply(preview);
    setOpen(false);
    setPreview(null);
    setVibe("");
  }

  return (
    <div className="card-surface p-5 border-accent/30 bg-accent/[0.03]">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center flex-shrink-0">
          <Wand2 className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold mb-1">Fill with AI</h3>
          <p className="text-sm text-muted-foreground">
            Describe your brand vibe in plain English. AI fills colors, voice, audience,
            anchors, hashtags, and CTA — all editable after.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPreview(null); setVibe(""); } }}>
          <DialogTrigger asChild>
            <Button>
              <SparklesIcon className="w-4 h-4" /> Fill with AI
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-accent" /> Fill brand from a vibe
              </DialogTitle>
              <DialogDescription>
                {preview
                  ? "Review the suggestion. Apply to fill the form (you still need to Save brand to commit)."
                  : "Tell the AI what your brand feels like — be specific about audience, mood, and any concrete details."}
              </DialogDescription>
            </DialogHeader>

            {!preview ? (
              <div className="space-y-2">
                <Label>Vibe brief</Label>
                <Textarea
                  rows={6}
                  placeholder={`e.g. "Dark fintech for SMB founders in the GCC. Confident, no fluff. Electric blue accent. Pricing $1K starting. Punchy hooks, real numbers."`}
                  value={vibe}
                  onChange={(e) => setVibe(e.target.value)}
                  autoFocus
                />
              </div>
            ) : (
              <AiFillPreview fill={preview} />
            )}

            <DialogFooter>
              {!preview ? (
                <>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={onGenerate} disabled={pending || !vibe.trim()}>
                    <SparklesIcon className="w-4 h-4" />
                    {pending ? "Generating…" : "Generate"}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setPreview(null)}>← Back to brief</Button>
                  <Button onClick={onConfirmApply}>
                    <Check className="w-4 h-4" /> Apply to form
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function AiFillPreview({ fill }: { fill: AiBrandFill }) {
  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      {fill.rationale && (
        <div className="card-surface p-3 text-sm bg-accent/[0.04]">
          <div className="text-xs font-mono uppercase tracking-widest text-accent mb-1">Rationale</div>
          {fill.rationale}
        </div>
      )}
      {fill.colors && (
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Colors</div>
          <div className="grid grid-cols-7 gap-2">
            {(Object.entries(fill.colors) as Array<[string, string]>).map(([k, v]) => (
              <div key={k} className="text-center">
                <div className="w-full aspect-square rounded-lg border border-border" style={{ background: v }} />
                <div className="text-[10px] font-mono text-muted-foreground mt-1 truncate">{k}</div>
                <div className="text-[10px] font-mono text-foreground/80">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {fill.voice && (
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Voice</div>
          <p className="text-sm">{fill.voice}</p>
        </div>
      )}
      {fill.audience && (
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Audience</div>
          <p className="text-sm">{fill.audience}</p>
        </div>
      )}
      {fill.anchors && Object.keys(fill.anchors).length > 0 && (
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Anchors</div>
          <div className="flex flex-wrap gap-2 text-sm">
            {Object.entries(fill.anchors).map(([k, v]) => (
              <span key={k} className="border border-border rounded-full px-3 py-1 text-xs font-mono">
                <span className="text-muted-foreground">{k}:</span> {v}
              </span>
            ))}
          </div>
        </div>
      )}
      {fill.hashtagPool && fill.hashtagPool.length > 0 && (
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Hashtags</div>
          <div className="flex flex-wrap gap-1.5">
            {fill.hashtagPool.map((h) => (
              <span key={h} className="bg-secondary rounded-full px-3 py-1 text-xs font-mono">{h}</span>
            ))}
          </div>
        </div>
      )}
      {fill.ctaDefault && (
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">CTA</div>
          <span className="bg-primary/15 text-primary border border-primary/30 rounded-md px-3 py-1.5 text-sm font-medium">
            {fill.ctaDefault}
          </span>
        </div>
      )}
    </div>
  );
}
