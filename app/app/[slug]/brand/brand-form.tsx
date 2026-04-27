"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveBrandAction } from "./actions";

type BrandData = {
  name: string;
  tagline: string | null;
  domain: string | null;
  logoSvg: string;
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

const SECTION = "card-surface p-6 space-y-4";

export function BrandForm({ slug, initial }: { slug: string; initial: BrandData }) {
  const [data, setData] = useState<BrandData>({
    ...initial,
    tagline: initial.tagline ?? "",
    domain: initial.domain ?? "",
    anchors: initial.anchors ?? {},
    hashtagPool: initial.hashtagPool ?? [],
  });
  const [pending, startTransition] = useTransition();

  function update<K extends keyof BrandData>(key: K, value: BrandData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function updateColor(k: keyof BrandData["colors"], v: string) {
    setData((d) => ({ ...d, colors: { ...d.colors, [k]: v } }));
  }
  function updateFont(k: keyof BrandData["fonts"], v: string) {
    setData((d) => ({ ...d, fonts: { ...d.fonts, [k]: v } }));
  }

  // anchors as pairs
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
    const next = anchorEntries.filter((_, idx) => idx !== i);
    update("anchors", Object.fromEntries(next));
  }

  function setHashtagAt(i: number, v: string) {
    const next = [...data.hashtagPool];
    next[i] = v.startsWith("#") ? v : `#${v}`;
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

  return (
    <div className="space-y-6">
      <div className={SECTION}>
        <h3 className="font-semibold">Identity</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name">
            <Input value={data.name} onChange={(e) => update("name", e.target.value)} />
          </Field>
          <Field label="Domain">
            <Input value={data.domain ?? ""} onChange={(e) => update("domain", e.target.value)} />
          </Field>
        </div>
        <Field label="Tagline">
          <Input value={data.tagline ?? ""} onChange={(e) => update("tagline", e.target.value)} />
        </Field>
        <Field label="Voice (tone description for the AI)">
          <Textarea
            rows={4}
            value={data.voice}
            onChange={(e) => update("voice", e.target.value)}
            placeholder="Direct, confident, no fluff..."
          />
        </Field>
        <Field label="Audience">
          <Textarea
            rows={3}
            value={data.audience}
            onChange={(e) => update("audience", e.target.value)}
            placeholder="Who you're talking to — industry, role, region, what tools they use"
          />
        </Field>
      </div>

      <div className={SECTION}>
        <h3 className="font-semibold">Logo</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Text before highlight">
            <Input value={data.logoTextBefore} onChange={(e) => update("logoTextBefore", e.target.value)} />
          </Field>
          <Field label="Highlighted part">
            <Input value={data.logoTextHighlight} onChange={(e) => update("logoTextHighlight", e.target.value)} />
          </Field>
          <Field label="Text after">
            <Input value={data.logoTextAfter} onChange={(e) => update("logoTextAfter", e.target.value)} />
          </Field>
        </div>
        <Field label="Logo SVG (use {size} placeholder for width/height)">
          <Textarea
            rows={6}
            className="font-mono text-xs"
            value={data.logoSvg}
            onChange={(e) => update("logoSvg", e.target.value)}
          />
        </Field>
        <div className="text-xs text-muted-foreground">
          Preview:{" "}
          <span
            className="inline-block ml-2 align-middle"
            dangerouslySetInnerHTML={{ __html: data.logoSvg.replace(/\{size\}/g, "32") }}
          />
        </div>
      </div>

      <div className={SECTION}>
        <h3 className="font-semibold">Colors</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(data.colors) as Array<keyof BrandData["colors"]>).map((k) => (
            <Field key={k} label={k}>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  className="w-10 h-10 rounded-md border border-border bg-transparent cursor-pointer"
                  value={data.colors[k]}
                  onChange={(e) => updateColor(k, e.target.value)}
                />
                <Input className="font-mono text-xs" value={data.colors[k]} onChange={(e) => updateColor(k, e.target.value)} />
              </div>
            </Field>
          ))}
        </div>
      </div>

      <div className={SECTION}>
        <h3 className="font-semibold">Fonts</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Sans (display + body)">
            <Input value={data.fonts.sans} onChange={(e) => updateFont("sans", e.target.value)} />
          </Field>
          <Field label="Mono">
            <Input value={data.fonts.mono} onChange={(e) => updateFont("mono", e.target.value)} />
          </Field>
        </div>
        <Field label="Google Fonts URL">
          <Input
            className="font-mono text-xs"
            value={data.fonts.googleFontsUrl}
            onChange={(e) => updateFont("googleFontsUrl", e.target.value)}
          />
        </Field>
      </div>

      <div className={SECTION}>
        <h3 className="font-semibold">Pricing anchors</h3>
        <p className="text-xs text-muted-foreground">
          Key value props with numbers. The AI uses these in slides and captions (e.g. <code>$1,000</code>, <code>5–10 days</code>).
        </p>
        <div className="space-y-2">
          {anchorEntries.map(([k, v], i) => (
            <div key={i} className="flex gap-2">
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
      </div>

      <div className={SECTION}>
        <h3 className="font-semibold">Hashtag pool</h3>
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
      </div>

      <div className={SECTION}>
        <h3 className="font-semibold">CTA default</h3>
        <Field label="Button text used on closing slides">
          <Input value={data.ctaDefault} onChange={(e) => update("ctaDefault", e.target.value)} />
        </Field>
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={onSave} disabled={pending} size="lg" className="shadow-lg">
          <Save className="w-4 h-4" /> {pending ? "Saving..." : "Save brand"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="capitalize">{label}</Label>
      {children}
    </div>
  );
}
