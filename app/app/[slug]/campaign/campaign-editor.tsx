"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Plus, X, Sparkles, Trash2, Pencil, ChevronUp, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  saveCampaignAction,
  addQueueItemAction,
  updateQueueItemAction,
  deleteQueueItemAction,
  moveQueueItemAction,
  aiBuildCampaignAction,
  aiSuggestQueueItemsAction,
} from "./actions";

type Pillar = { name: string; description: string };
type Campaign = {
  id: string;
  name: string;
  goal: string;
  audience: string;
  frequency: string;
  formatMix: string;
  pillars: Pillar[];
  toneRules: string[];
};
type Queue = { id: string; topic: string; pillar: string | null; format: string | null; notes: string | null };

const SECTION = "card-surface p-6 space-y-4";

export function CampaignEditor({
  slug,
  initial,
  queue,
}: {
  slug: string;
  initial: Campaign;
  queue: Queue[];
}) {
  const [data, setData] = useState<Campaign>({
    ...initial,
    pillars: initial.pillars ?? [],
    toneRules: initial.toneRules ?? [],
  });
  const [pending, startTransition] = useTransition();

  function update<K extends keyof Campaign>(key: K, value: Campaign[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function setPillarAt(i: number, p: Pillar) {
    const next = [...data.pillars];
    next[i] = p;
    update("pillars", next);
  }
  function addPillar() {
    update("pillars", [...data.pillars, { name: "", description: "" }]);
  }
  function removePillar(i: number) {
    update("pillars", data.pillars.filter((_, idx) => idx !== i));
  }

  function setToneAt(i: number, v: string) {
    const next = [...data.toneRules];
    next[i] = v;
    update("toneRules", next);
  }
  function addTone() {
    update("toneRules", [...data.toneRules, ""]);
  }
  function removeTone(i: number) {
    update("toneRules", data.toneRules.filter((_, idx) => idx !== i));
  }

  function onSave() {
    startTransition(async () => {
      const cleaned = {
        ...data,
        pillars: data.pillars.filter((p) => p.name.trim()),
        toneRules: data.toneRules.filter((t) => t.trim()),
      };
      const res = await saveCampaignAction(slug, cleaned);
      if (res?.error) toast.error(res.error);
      else toast.success("Campaign saved");
    });
  }

  return (
    <div className="space-y-6">
      <AICampaignHelper slug={slug} />

      <div className={SECTION}>
        <h3 className="font-semibold">Strategy</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Campaign name">
            <Input value={data.name} onChange={(e) => update("name", e.target.value)} />
          </Field>
          <Field label="Frequency">
            <Input value={data.frequency} onChange={(e) => update("frequency", e.target.value)} />
          </Field>
        </div>
        <Field label="Goal">
          <Textarea rows={3} value={data.goal} onChange={(e) => update("goal", e.target.value)} />
        </Field>
        <Field label="Audience">
          <Textarea rows={3} value={data.audience} onChange={(e) => update("audience", e.target.value)} />
        </Field>
        <Field label="Format mix">
          <Textarea rows={2} value={data.formatMix} onChange={(e) => update("formatMix", e.target.value)} />
        </Field>
      </div>

      <div className={SECTION}>
        <h3 className="font-semibold">Content pillars</h3>
        <p className="text-xs text-muted-foreground">
          The AI rotates across these so you don&apos;t hit the same angle twice in a row.
        </p>
        <div className="space-y-2">
          {data.pillars.map((p, i) => (
            <div key={i} className="grid grid-cols-[200px_1fr_auto] gap-2 items-start">
              <Input
                placeholder="Name"
                value={p.name}
                onChange={(e) => setPillarAt(i, { ...p, name: e.target.value })}
              />
              <Input
                placeholder="Description"
                value={p.description}
                onChange={(e) => setPillarAt(i, { ...p, description: e.target.value })}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removePillar(i)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addPillar}>
            <Plus className="w-3 h-3" /> Add pillar
          </Button>
        </div>
      </div>

      <div className={SECTION}>
        <h3 className="font-semibold">Tone rules</h3>
        <div className="space-y-2">
          {data.toneRules.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Input value={r} onChange={(e) => setToneAt(i, e.target.value)} placeholder="One rule" />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeTone(i)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addTone}>
            <Plus className="w-3 h-3" /> Add rule
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={pending} size="lg">
          <Save className="w-4 h-4" /> {pending ? "Saving..." : "Save campaign"}
        </Button>
      </div>

      <QueueSection slug={slug} queue={queue} pillarNames={data.pillars.map((p) => p.name)} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function AICampaignHelper({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [pending, startTransition] = useTransition();

  function onBuild() {
    if (!brief.trim()) return;
    startTransition(async () => {
      const res = await aiBuildCampaignAction(slug, brief);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(`Campaign built. ${res.count} ideas added to queue.`);
        setOpen(false);
        setBrief("");
      }
    });
  }

  return (
    <div className="card-surface p-6 border-accent/30 bg-accent/[0.02]">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold mb-1">Let AI draft your campaign</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Describe what you want this campaign to achieve. The AI will generate pillars, tone rules,
            and a starter queue of 8–12 specific post ideas — all editable.
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Sparkles className="w-4 h-4" /> Help me build a campaign
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Build campaign with AI</DialogTitle>
                <DialogDescription>
                  This replaces your current campaign and queue. Be specific — the more context, the better.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                rows={8}
                placeholder={`e.g. "First 30 days post-launch. Goal is bookings from SMB founders and funded startups in Lebanon and the GCC. Mix of value (pricing, what we build), proof (case studies of PropGroup and Luminworth), comparison (us vs agencies), and education on what AI can do for small businesses."`}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={onBuild} disabled={pending || !brief.trim()}>
                  {pending ? "Generating..." : "Build campaign"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

const FORMAT_OPTIONS = ["carousel", "story", "case-study"];

function QueueSection({
  slug,
  queue: initialQueue,
  pillarNames,
}: {
  slug: string;
  queue: Queue[];
  pillarNames: string[];
}) {
  const [queue, setQueue] = useState(initialQueue);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [pillar, setPillar] = useState("");
  const [format, setFormat] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function resetAddForm() {
    setTopic("");
    setPillar("");
    setFormat("");
    setNotes("");
  }

  function onAdd() {
    if (!topic.trim()) return;
    startTransition(async () => {
      const res = await addQueueItemAction(slug, {
        topic,
        pillar: pillar || undefined,
        format: format || undefined,
        notes: notes || undefined,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Added to queue");
      resetAddForm();
      setShowAdd(false);
      window.location.reload();
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      await deleteQueueItemAction(slug, id);
      setQueue((q) => q.filter((i) => i.id !== id));
    });
  }

  function onMove(id: string, direction: "up" | "down") {
    const idx = queue.findIndex((q) => q.id === id);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= queue.length) return;
    // Optimistic local swap, then persist.
    setQueue((q) => {
      const next = [...q];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
    startTransition(async () => {
      const res = await moveQueueItemAction(slug, id, direction);
      if (res?.error) {
        toast.error(res.error);
        // Revert on failure
        setQueue(initialQueue);
      }
    });
  }

  function onSaveEdit(id: string, patch: { topic: string; pillar: string; format: string; notes: string }) {
    if (!patch.topic.trim()) {
      toast.error("Topic is required");
      return;
    }
    startTransition(async () => {
      const res = await updateQueueItemAction(slug, id, {
        topic: patch.topic,
        pillar: patch.pillar || undefined,
        format: patch.format || undefined,
        notes: patch.notes || undefined,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setQueue((q) =>
        q.map((i) =>
          i.id === id
            ? {
                ...i,
                topic: patch.topic,
                pillar: patch.pillar || null,
                format: patch.format || null,
                notes: patch.notes || null,
              }
            : i,
        ),
      );
      setEditingId(null);
      toast.success("Updated");
    });
  }

  return (
    <div className={SECTION}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold">Idea queue</h3>
          <p className="text-xs text-muted-foreground">
            {queue.length} ideas. Top of list goes next when you click <em>Generate next</em>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SuggestMoreIdeasButton slug={slug} />
          <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="w-3 h-3" /> Add idea
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="space-y-2 border border-border/60 rounded-lg p-3 bg-secondary/30">
          <Input placeholder="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <Select value={pillar || "__none__"} onValueChange={(v) => setPillar(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Pillar (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {pillarNames.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={format || "__any__"} onValueChange={(v) => setFormat(v === "__any__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Format (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Any</SelectItem>
                {FORMAT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Textarea rows={2} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); resetAddForm(); }}>Cancel</Button>
            <Button size="sm" onClick={onAdd} disabled={pending}>Add</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No ideas in the queue yet.</p>
        ) : (
          queue.map((q, i) =>
            editingId === q.id ? (
              <QueueItemEditor
                key={q.id}
                item={q}
                pillarNames={pillarNames}
                onCancel={() => setEditingId(null)}
                onSave={(patch) => onSaveEdit(q.id, patch)}
                pending={pending}
              />
            ) : (
              <div key={q.id} className="flex items-start gap-3 border border-border/60 rounded-lg p-3 group">
                <div className="font-mono text-xs text-muted-foreground mt-1 w-6 flex-shrink-0">#{i + 1}</div>

                {/* Reorder arrows */}
                <div className="flex flex-col flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onMove(q.id, "up")}
                    disabled={i === 0 || pending}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                    title="Move up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(q.id, "down")}
                    disabled={i === queue.length - 1 || pending}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                    title="Move down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium">{q.topic}</div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    {q.pillar && <span>📌 {q.pillar}</span>}
                    {q.format && <span>🎨 {q.format}</span>}
                  </div>
                  {q.notes && <p className="text-xs text-muted-foreground mt-1">{q.notes}</p>}
                </div>

                <div className="flex flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingId(q.id)}
                    disabled={pending}
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(q.id)}
                    disabled={pending}
                    title="Delete"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}

function SuggestMoreIdeasButton({ slug }: { slug: string }) {
  const [count, setCount] = useState(5);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onGenerate() {
    startTransition(async () => {
      const res = await aiSuggestQueueItemsAction(slug, count);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.count} new ideas added to the queue`);
      setOpen(false);
      window.location.reload();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Sparkles className="w-3 h-3" /> Suggest ideas
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" /> Suggest more ideas
          </DialogTitle>
          <DialogDescription>
            AI reads your published posts and remaining queue, then proposes new ideas
            that build continuity and don&apos;t repeat angles. Appended to the bottom
            of the queue.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>How many ideas?</Label>
          <Input
            type="number"
            min={1}
            max={15}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">Between 1 and 15.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={onGenerate} disabled={pending}>
            <Sparkles className="w-4 h-4" /> {pending ? "Generating…" : `Suggest ${count} ideas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QueueItemEditor({
  item,
  pillarNames,
  onSave,
  onCancel,
  pending,
}: {
  item: Queue;
  pillarNames: string[];
  onSave: (patch: { topic: string; pillar: string; format: string; notes: string }) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [topic, setTopic] = useState(item.topic);
  const [pillar, setPillar] = useState(item.pillar ?? "");
  const [format, setFormat] = useState(item.format ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");

  return (
    <div className="space-y-2 border border-accent/40 rounded-lg p-3 bg-accent/[0.04]">
      <Input placeholder="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <Select value={pillar} onValueChange={setPillar}>
          <SelectTrigger><SelectValue placeholder="Pillar (optional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {pillarNames.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger><SelectValue placeholder="Format (optional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any</SelectItem>
            {FORMAT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Textarea rows={2} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => onSave({ topic, pillar, format, notes })} disabled={pending}>
          <Check className="w-3 h-3" /> Save
        </Button>
      </div>
    </div>
  );
}
