"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Copy,
  Trash2,
  ChevronLeft,
  Download,
  CalendarClock,
  CheckCircle2,
  XCircle,
  FileText,
  Archive,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setPostStatusAction, deletePostAction, type PostStatus } from "../actions";
import { publishPostNowAction } from "../../instagram-actions";
import { formatDate } from "@/lib/utils";

type Post = {
  id: string;
  name: string;
  topic: string;
  summary: string;
  pillar: string | null;
  format: string | null;
  caption: string;
  imageUrls: string[];
  status: PostStatus;
  scheduledFor: string | null;
  createdAt: string;
  postedAt: string | null;
  igMediaId: string | null;
  publishError: string | null;
  publishAttempts: number;
  lastAttemptAt: string | null;
};

const STATUS_META: Record<
  PostStatus,
  { label: string; tone: "default" | "secondary" | "success" | "destructive" | "outline"; icon: typeof FileText }
> = {
  draft: { label: "Draft", tone: "secondary", icon: FileText },
  scheduled: { label: "Scheduled", tone: "default", icon: CalendarClock },
  posted: { label: "Posted", tone: "success", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", tone: "destructive", icon: XCircle },
  archived: { label: "Archived", tone: "outline", icon: Archive },
};

export function PostView({
  slug,
  post,
  igConnected,
}: {
  slug: string;
  post: Post;
  igConnected: boolean;
}) {
  const urls = post.imageUrls;
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  function publishNow() {
    if (!igConnected) {
      toast.error("Instagram is not connected for this project. Connect it from the project overview.");
      return;
    }
    if (!confirm("Publish this post to Instagram right now?")) return;
    startTransition(async () => {
      try {
        const res = await publishPostNowAction(slug, post.id);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success("Posted to Instagram");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function copy() {
    navigator.clipboard.writeText(post.caption);
    setCopied(true);
    toast.success("Caption copied");
    setTimeout(() => setCopied(false), 1500);
  }

  function changeStatus(status: PostStatus, scheduledFor?: string) {
    startTransition(async () => {
      try {
        const res = await setPostStatusAction(slug, post.id, status, scheduledFor);
        if (res && "error" in res && res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(`Marked ${STATUS_META[status].label.toLowerCase()}`);
        setScheduleOpen(false);
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

  async function downloadAll() {
    // Sequential client-side downloads — no need for a server zip.
    // R2 PNGs are tiny and Cache-Control: public, so this is fast.
    toast.info(`Downloading ${urls.length} slide${urls.length > 1 ? "s" : ""}…`);
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const fname = urls.length === 1
          ? `${post.name}.png`
          : `${post.name}-slide-${String(i + 1).padStart(2, "0")}.png`;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      } catch (e) {
        console.error("Download failed for", url, e);
      }
    }
    toast.success("All slides downloaded");
  }

  const StatusIcon = STATUS_META[post.status].icon;
  const isStory = post.format === "story";

  return (
    <div>
      <Link
        href={`/app/${slug}/posts`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="w-3 h-3" /> All posts
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold tracking-tight mb-1">{post.topic}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{post.name}</span>
            {post.pillar && <Badge variant="outline">{post.pillar}</Badge>}
            {post.format && <Badge variant="outline">{post.format}</Badge>}
            <Badge variant={STATUS_META[post.status].tone}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {STATUS_META[post.status].label}
              {post.status === "scheduled" && post.scheduledFor && (
                <span className="ml-1 font-mono text-[10px] opacity-80">
                  · {formatDate(post.scheduledFor)}
                </span>
              )}
            </Badge>
          </div>
        </div>
      </div>

      {/* Publish error banner — visible when last attempt failed */}
      {post.publishError && post.status !== "posted" && (
        <div className="card-surface p-4 mb-4 border-destructive/40 bg-destructive/[0.06]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-destructive mb-1">
                Last publish attempt failed{" "}
                <span className="font-mono text-xs opacity-70">
                  ({post.publishAttempts}× tried{post.lastAttemptAt ? `, ${formatDate(post.lastAttemptAt)}` : ""})
                </span>
              </div>
              <div className="font-mono text-xs text-foreground/80 break-words">{post.publishError}</div>
            </div>
          </div>
        </div>
      )}

      {/* Posted-to-IG success banner */}
      {post.status === "posted" && post.igMediaId && (
        <div className="card-surface p-4 mb-4 border-emerald-500/30 bg-emerald-500/[0.06]">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 text-sm">
              Published to Instagram{post.postedAt ? ` on ${formatDate(post.postedAt)}` : ""}.
            </div>
            <a
              href={`https://www.instagram.com/p/${post.igMediaId}/`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-emerald-400 hover:underline inline-flex items-center gap-1"
            >
              View on IG <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Status changer bar */}
      <div className="card-surface p-3 mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground px-2">
          Status:
        </span>
        <StatusBtn target="draft" current={post.status} onClick={() => changeStatus("draft")} disabled={pending}>
          <FileText className="w-3.5 h-3.5" /> Draft
        </StatusBtn>
        <StatusBtn target="scheduled" current={post.status} onClick={() => setScheduleOpen(true)} disabled={pending}>
          <CalendarClock className="w-3.5 h-3.5" /> Schedule
        </StatusBtn>
        <StatusBtn target="posted" current={post.status} onClick={() => changeStatus("posted")} disabled={pending}>
          <CheckCircle2 className="w-3.5 h-3.5" /> Mark posted
        </StatusBtn>
        {igConnected && (
          <Button
            size="sm"
            variant="default"
            onClick={publishNow}
            disabled={pending || post.status === "posted"}
            title="Publish to Instagram immediately"
            className="bg-emerald-600 hover:bg-emerald-600/90"
          >
            <InstagramGlyph className="w-3.5 h-3.5" /> Post to IG now
          </Button>
        )}
        <StatusBtn target="cancelled" current={post.status} onClick={() => changeStatus("cancelled")} disabled={pending}>
          <XCircle className="w-3.5 h-3.5" /> Cancel
        </StatusBtn>
        <StatusBtn target="archived" current={post.status} onClick={() => changeStatus("archived")} disabled={pending}>
          <Archive className="w-3.5 h-3.5" /> Archive
        </StatusBtn>
        <div className="ml-auto">
          <Button
            variant="outline"
            onClick={onDelete}
            disabled={pending}
            className="text-destructive hover:bg-destructive/10 border-destructive/30"
            size="sm"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Slides ({urls.length})
            </h3>
            {urls.length > 0 && (
              <Button variant="outline" size="sm" onClick={downloadAll}>
                <Download className="w-3.5 h-3.5" />
                {urls.length === 1 ? "Download PNG" : "Download all"}
              </Button>
            )}
          </div>
          <div className={isStory && urls.length === 1 ? "max-w-md" : "grid sm:grid-cols-2 gap-3"}>
            {urls.map((url, i) => (
              <div key={url} className="card-surface overflow-hidden">
                <div className={isStory ? "aspect-[9/16] bg-secondary" : "aspect-[4/5] bg-secondary"}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                </div>
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">
                    {urls.length === 1 ? "Image" : `Slide ${String(i + 1).padStart(2, "0")}`}
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

          <div className="card-surface p-4 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="font-mono">{formatDate(post.createdAt)}</span>
            </div>
            {post.scheduledFor && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scheduled</span>
                <span className="font-mono">{formatDate(post.scheduledFor)}</span>
              </div>
            )}
            {post.postedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Posted</span>
                <span className="font-mono">{formatDate(post.postedAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onConfirm={(dt) => changeStatus("scheduled", dt)}
        defaultDate={post.scheduledFor}
        pending={pending}
      />
    </div>
  );
}

function StatusBtn({
  current,
  target,
  children,
  onClick,
  disabled,
}: {
  current: PostStatus;
  target: PostStatus;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  const active = current === target;
  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function ScheduleDialog({
  open,
  onOpenChange,
  onConfirm,
  defaultDate,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (iso: string) => void;
  defaultDate: string | null;
  pending: boolean;
}) {
  const [value, setValue] = useState(() => {
    const d = defaultDate ? new Date(defaultDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    return toLocalIsoForInput(d);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-accent" /> Schedule post
          </DialogTitle>
          <DialogDescription>
            Pick when you want this to go live. We&apos;ll just track the time — no auto-publish to Instagram yet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="schedule-at">Scheduled for</Label>
          <Input
            id="schedule-at"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onConfirm(new Date(value).toISOString())} disabled={pending || !value}>
            <CalendarClock className="w-4 h-4" /> Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Convert a Date to the value format the <input type="datetime-local"> expects. */
function toLocalIsoForInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
