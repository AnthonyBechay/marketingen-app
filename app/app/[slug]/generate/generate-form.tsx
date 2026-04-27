"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, ArrowRight, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { generateFromIdeaAction, generateFromQueueAction } from "./actions";

export function GenerateForm({
  slug,
  nextQueue,
}: {
  slug: string;
  nextQueue: Array<{ id: string; topic: string; pillar: string | null }>;
}) {
  const [idea, setIdea] = useState("");
  const [pending, startTransition] = useTransition();

  function onIdeaSubmit() {
    if (!idea.trim()) return;
    startTransition(async () => {
      const res = await generateFromIdeaAction(slug, idea);
      // Success path redirects, so any return is an error.
      if (res?.error) toast.error(res.error);
    });
  }

  function onQueueGenerate() {
    startTransition(async () => {
      const res = await generateFromQueueAction(slug);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {nextQueue.length > 0 && (
        <div className="card-surface p-6 space-y-4 border-accent/30 bg-accent/[0.02]">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center flex-shrink-0">
              <ListOrdered className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Next from your queue</h3>
              <p className="text-sm text-muted-foreground">
                Pull the top-ranked idea from your campaign queue. After rendering, it&apos;s removed from the queue automatically.
              </p>
            </div>
          </div>
          <div className="space-y-2 pl-14">
            {nextQueue.map((q, i) => (
              <div key={q.id} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-xs text-muted-foreground w-6">#{i + 1}</span>
                <span className="flex-1 truncate">{q.topic}</span>
                {q.pillar && <Badge variant="outline">{q.pillar}</Badge>}
              </div>
            ))}
          </div>
          <div className="pl-14">
            <Button onClick={onQueueGenerate} disabled={pending} size="lg">
              <Sparkles className="w-4 h-4" />
              {pending ? "Generating + rendering..." : "Generate next from queue"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="card-surface p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Or describe a fresh idea</h3>
            <p className="text-sm text-muted-foreground">
              The AI uses your brand voice + last 8 posts so it doesn&apos;t repeat angles.
            </p>
          </div>
        </div>
        <div className="pl-14 space-y-3">
          <Textarea
            rows={5}
            placeholder="e.g. Why every business needs a CRM in 2026 — aimed at SMB owners still using Excel spreadsheets"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
          <Button onClick={onIdeaSubmit} disabled={pending || !idea.trim()}>
            <Sparkles className="w-4 h-4" /> {pending ? "Generating + rendering..." : "Generate post"}
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground text-center">
        Generation typically takes 15–40 seconds — Claude writes the post, then Playwright renders each slide and uploads to R2.
      </div>
    </div>
  );
}
