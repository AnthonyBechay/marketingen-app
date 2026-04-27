"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, CheckCircle2, Trash2, Archive, Undo, ChevronLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { setPostStatusAction, deletePostAction } from "../actions";

type Post = {
  id: string;
  name: string;
  topic: string;
  summary: string;
  pillar: string | null;
  format: string | null;
  caption: string;
  imageUrls: string[];
  status: "draft" | "posted" | "archived";
  createdAt: string;
  postedAt: string | null;
};

export function PostView({ slug, post }: { slug: string; post: Post }) {
  const urls = post.imageUrls;
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function copy() {
    navigator.clipboard.writeText(post.caption);
    setCopied(true);
    toast.success("Caption copied");
    setTimeout(() => setCopied(false), 1500);
  }

  function mark(status: "draft" | "posted" | "archived") {
    startTransition(async () => {
      try {
        await setPostStatusAction(slug, post.id, status);
        toast.success(`Marked ${status}`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function onDelete() {
    if (!confirm("Delete this post and its images? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        const res = await deletePostAction(slug, post.id);
        if (res && "error" in res && res.error) toast.error(res.error);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <div>
      <Link
        href={`/app/${slug}/posts`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="w-3 h-3" /> All posts
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">{post.topic}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{post.name}</span>
            {post.pillar && <Badge variant="outline">{post.pillar}</Badge>}
            <Badge variant={post.status === "posted" ? "success" : "secondary"}>{post.status}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {post.status !== "posted" ? (
            <Button onClick={() => mark("posted")} disabled={pending}>
              <CheckCircle2 className="w-4 h-4" /> Mark posted
            </Button>
          ) : (
            <Button variant="outline" onClick={() => mark("draft")} disabled={pending}>
              <Undo className="w-4 h-4" /> Mark draft
            </Button>
          )}
          {post.status !== "archived" && (
            <Button variant="outline" onClick={() => mark("archived")} disabled={pending}>
              <Archive className="w-4 h-4" /> Archive
            </Button>
          )}
          <Button variant="outline" onClick={onDelete} disabled={pending} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Slides ({urls.length})
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {urls.map((url, i) => (
              <div key={url} className="card-surface overflow-hidden">
                <div className="aspect-[4/5] bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                </div>
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">
                    Slide {String(i + 1).padStart(2, "0")}
                  </span>
                  <a
                    href={url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-accent inline-flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> PNG
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Caption
          </h3>
          <Textarea readOnly value={post.caption} rows={18} className="font-mono text-xs" />
          <Button onClick={copy} className="w-full" variant={copied ? "secondary" : "default"}>
            <Copy className="w-4 h-4" /> {copied ? "Copied!" : "Copy caption"}
          </Button>

          {post.summary && (
            <div className="card-surface p-4 text-sm">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Summary</div>
              {post.summary}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
