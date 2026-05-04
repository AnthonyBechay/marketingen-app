"use client";
import { useMemo, useRef, useState, useTransition } from "react";
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
  Send,
  Plug,
  RotateCcw,
  Pencil,
  Check,
  X as XIcon,
  Upload,
  ImagePlus,
  ImageMinus,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
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
import { ProviderGlyph } from "@/components/provider-glyph";
import {
  deletePostAction,
  setPostImagesAction,
  updatePostCaptionAction,
} from "../actions";
import {
  cancelTargetAction,
  publishTargetNowAction,
  resetTargetAction,
  scheduleTargetsAction,
  setPostLifecycleAction,
  setPostTargetsAction,
} from "../../target-actions";
import { formatDate } from "@/lib/utils";

export type Target = {
  id: string;
  connectionId: string;
  provider: "instagram" | "linkedin";
  providerName: string;
  providerColor: string;
  accountHandle: string | null;
  accountName: string | null;
  status: "pending" | "scheduled" | "publishing" | "posted" | "failed" | "cancelled";
  scheduledFor: string | null;
  postedAt: string | null;
  providerPostId: string | null;
  providerUrl: string | null;
  error: string | null;
  attempts: number;
  lastAttemptAt: string | null;
};

export type AvailableConnection = {
  id: string;
  provider: "instagram" | "linkedin";
  providerName: string;
  providerColor: string;
  accountHandle: string | null;
  accountName: string | null;
  customLabel: string | null;
};

export type PostViewData = {
  id: string;
  name: string;
  topic: string;
  summary: string;
  pillar: string | null;
  format: string | null;
  caption: string;
  imageUrls: string[];
  status: "draft" | "scheduled" | "posted" | "cancelled" | "archived";
  scheduledFor: string | null;
  createdAt: string;
  postedAt: string | null;
  targets: Target[];
  availableConnections: AvailableConnection[];
};

const POST_STATUS_META: Record<
  PostViewData["status"],
  { label: string; tone: "default" | "secondary" | "success" | "destructive" | "outline"; icon: typeof FileText }
> = {
  draft: { label: "Draft", tone: "secondary", icon: FileText },
  scheduled: { label: "Scheduled", tone: "default", icon: CalendarClock },
  posted: { label: "Posted", tone: "success", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", tone: "destructive", icon: XCircle },
  archived: { label: "Archived", tone: "outline", icon: Archive },
};

const TARGET_STATUS_META: Record<
  Target["status"],
  { label: string; tone: "default" | "secondary" | "success" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", tone: "secondary" },
  scheduled: { label: "Scheduled", tone: "default" },
  publishing: { label: "Publishing…", tone: "default" },
  posted: { label: "Posted", tone: "success" },
  failed: { label: "Failed", tone: "destructive" },
  cancelled: { label: "Cancelled", tone: "outline" },
};

export function PostView({ slug, post }: { slug: string; post: PostViewData }) {
  const [urls, setUrls] = useState<string[]>(post.imageUrls);
  const [caption, setCaption] = useState(post.caption);
  const [editingCaption, setEditingCaption] = useState(false);
  const [pending, startTransition] = useTransition();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // The schedule dialog operates over the user's currently selected pending
  // targets — by default, all not-yet-posted ones.
  const [scheduleTargetIds, setScheduleTargetIds] = useState<string[]>([]);
  const isStory = post.format === "story";

  // ─── Caption edit ─────────────────────────────────────────────
  function onSaveCaption() {
    startTransition(async () => {
      const res = await updatePostCaptionAction(slug, post.id, caption);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Caption saved");
      setEditingCaption(false);
    });
  }
  function onCancelCaption() {
    setCaption(post.caption);
    setEditingCaption(false);
  }

  // ─── Slide image management ───────────────────────────────────
  // After every change we persist the URL list with setPostImagesAction.
  // The change is applied optimistically; on failure we revert.
  function persistUrls(next: string[]) {
    const prev = urls;
    setUrls(next);
    startTransition(async () => {
      const res = await setPostImagesAction(slug, post.id, next);
      if ("error" in res && res.error) {
        toast.error(res.error);
        setUrls(prev);
      }
    });
  }

  async function uploadFile(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(
      `/api/upload/post-image?slug=${encodeURIComponent(slug)}&postId=${encodeURIComponent(post.id)}`,
      { method: "POST", body: fd },
    );
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      toast.error(json.error ?? `Upload failed (${res.status})`);
      return null;
    }
    return json.url;
  }

  function onReplaceSlide(idx: number, file: File) {
    startTransition(async () => {
      const url = await uploadFile(file);
      if (!url) return;
      const next = [...urls];
      next[idx] = url;
      persistUrls(next);
      toast.success("Slide replaced");
    });
  }

  function onAddSlide(file: File) {
    if (urls.length >= 10) {
      toast.error("A post can have at most 10 slides");
      return;
    }
    startTransition(async () => {
      const url = await uploadFile(file);
      if (!url) return;
      persistUrls([...urls, url]);
      toast.success("Slide added");
    });
  }

  function onRemoveSlide(idx: number) {
    if (urls.length <= 1) {
      toast.error("A post needs at least one slide");
      return;
    }
    if (!confirm("Remove this slide?")) return;
    persistUrls(urls.filter((_, i) => i !== idx));
  }

  function onMoveSlide(idx: number, dir: "left" | "right") {
    const swap = dir === "left" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= urls.length) return;
    const next = [...urls];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    persistUrls(next);
  }

  const StatusIcon = POST_STATUS_META[post.status].icon;

  const activeTargets = useMemo(
    () => post.targets.filter((t) => t.status !== "cancelled"),
    [post.targets],
  );

  function copy() {
    navigator.clipboard.writeText(caption);
    toast.success("Caption copied");
  }

  function onChangeChannels(connectionIds: string[]) {
    startTransition(async () => {
      const res = await setPostTargetsAction(slug, post.id, connectionIds);
      if ("error" in res && res.error) toast.error(res.error);
      else toast.success("Channels updated");
    });
  }

  function openSchedule(targetIds: string[]) {
    if (targetIds.length === 0) {
      toast.error("Pick at least one channel to schedule");
      return;
    }
    setScheduleTargetIds(targetIds);
    setScheduleOpen(true);
  }

  function onConfirmSchedule(iso: string) {
    startTransition(async () => {
      const res = await scheduleTargetsAction(slug, post.id, scheduleTargetIds, iso);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Scheduled");
      setScheduleOpen(false);
    });
  }

  function onPublishNow(target: Target) {
    if (!confirm(`Publish to ${target.providerName} (${target.accountHandle ?? "account"}) right now?`)) return;
    startTransition(async () => {
      try {
        const res = await publishTargetNowAction(slug, post.id, target.id);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(`Posted to ${target.providerName}`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function onCancelTarget(target: Target) {
    startTransition(async () => {
      const res = await cancelTargetAction(slug, post.id, target.id);
      if ("error" in res && res.error) toast.error(res.error);
      else toast.success(`${target.providerName} cancelled`);
    });
  }

  function onResetTarget(target: Target) {
    startTransition(async () => {
      const res = await resetTargetAction(slug, post.id, target.id);
      if ("error" in res && res.error) toast.error(res.error);
      else toast.success(`${target.providerName} reset to pending`);
    });
  }

  function onLifecycle(status: "draft" | "cancelled" | "archived") {
    startTransition(async () => {
      const res = await setPostLifecycleAction(slug, post.id, status);
      if ("error" in res && res.error) toast.error(res.error);
      else toast.success(`Marked ${status}`);
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
    toast.info(`Downloading ${urls.length} slide${urls.length > 1 ? "s" : ""}…`);
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const fname =
          urls.length === 1
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
            <Badge variant={POST_STATUS_META[post.status].tone}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {POST_STATUS_META[post.status].label}
              {post.status === "scheduled" && post.scheduledFor && (
                <span className="ml-1 font-mono text-[10px] opacity-80">
                  · {formatDate(post.scheduledFor)}
                </span>
              )}
            </Badge>
          </div>
        </div>
      </div>

      {/* Channel manager + per-channel actions */}
      <ChannelsCard
        slug={slug}
        post={post}
        pending={pending}
        onChangeChannels={onChangeChannels}
        onPublishNow={onPublishNow}
        onCancelTarget={onCancelTarget}
        onResetTarget={onResetTarget}
        onSchedule={(ids) => openSchedule(ids)}
      />

      {/* Lifecycle bar (draft / cancel / archive / delete) */}
      <div className="card-surface p-3 mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground px-2">
          Lifecycle:
        </span>
        <Button
          size="sm"
          variant={post.status === "draft" ? "default" : "outline"}
          onClick={() => onLifecycle("draft")}
          disabled={pending}
        >
          <FileText className="w-3.5 h-3.5" /> Draft
        </Button>
        <Button
          size="sm"
          variant={post.status === "cancelled" ? "default" : "outline"}
          onClick={() => onLifecycle("cancelled")}
          disabled={pending}
        >
          <XCircle className="w-3.5 h-3.5" /> Cancel all
        </Button>
        <Button
          size="sm"
          variant={post.status === "archived" ? "default" : "outline"}
          onClick={() => onLifecycle("archived")}
          disabled={pending}
        >
          <Archive className="w-3.5 h-3.5" /> Archive
        </Button>
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
            <div className="flex items-center gap-2">
              <AddSlideButton
                onPick={onAddSlide}
                disabled={pending || urls.length >= 10}
              />
              {urls.length > 0 && (
                <Button variant="outline" size="sm" onClick={downloadAll}>
                  <Download className="w-3.5 h-3.5" />
                  {urls.length === 1 ? "Download PNG" : "Download all"}
                </Button>
              )}
            </div>
          </div>
          <div className={isStory && urls.length === 1 ? "max-w-md" : "grid sm:grid-cols-2 gap-3"}>
            {urls.map((url, i) => (
              <SlideCard
                key={`${i}-${url}`}
                url={url}
                index={i}
                total={urls.length}
                isStory={isStory}
                pending={pending}
                onReplace={(file) => onReplaceSlide(i, file)}
                onRemove={() => onRemoveSlide(i)}
                onMove={(dir) => onMoveSlide(i, dir)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Caption
            </h3>
            {editingCaption ? (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={onCancelCaption} disabled={pending}>
                  <XIcon className="w-3.5 h-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={onSaveCaption} disabled={pending}>
                  <Check className="w-3.5 h-3.5" /> Save
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditingCaption(true)}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
          </div>
          <Textarea
            readOnly={!editingCaption}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={18}
            className={`font-mono text-xs ${editingCaption ? "ring-1 ring-accent/40" : ""}`}
          />
          <Button onClick={copy} variant="outline" className="w-full">
            <Copy className="w-4 h-4" /> Copy caption
          </Button>

          {post.summary && (
            <div className="card-surface p-4 text-sm">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
                Summary
              </div>
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
        onConfirm={onConfirmSchedule}
        defaultDate={post.scheduledFor}
        targetCount={scheduleTargetIds.length}
        pending={pending}
      />

      {activeTargets.length === 0 && post.availableConnections.length === 0 && (
        <div className="card-surface p-6 mt-6 border-amber-500/30 bg-amber-500/[0.04]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-sm mb-1">No connections available</div>
              <div className="text-sm text-muted-foreground mb-3">
                Connect Instagram or LinkedIn to publish this post.
              </div>
              <Button asChild size="sm">
                <Link href={`/app/${slug}/connections`}>
                  <Plug className="w-3.5 h-3.5" /> Connect an account
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelsCard({
  slug,
  post,
  pending,
  onChangeChannels,
  onPublishNow,
  onCancelTarget,
  onResetTarget,
  onSchedule,
}: {
  slug: string;
  post: PostViewData;
  pending: boolean;
  onChangeChannels: (connectionIds: string[]) => void;
  onPublishNow: (target: Target) => void;
  onCancelTarget: (target: Target) => void;
  onResetTarget: (target: Target) => void;
  onSchedule: (targetIds: string[]) => void;
}) {
  const activeIds = useMemo(
    () =>
      post.targets
        .filter((t) => t.status !== "cancelled")
        .map((t) => t.connectionId),
    [post.targets],
  );

  function toggleConnection(connectionId: string, on: boolean) {
    const next = on
      ? Array.from(new Set([...activeIds, connectionId]))
      : activeIds.filter((id) => id !== connectionId);
    onChangeChannels(next);
  }

  // Targets we'd schedule by default in the bulk dialog: pending + failed.
  const scheduleableTargetIds = post.targets
    .filter((t) => t.status === "pending" || t.status === "failed")
    .map((t) => t.id);

  return (
    <div className="card-surface p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Send className="w-4 h-4 text-accent" /> Publish to
          </h3>
          <p className="text-xs text-muted-foreground">
            Pick the channels for this post. Each channel publishes independently.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending || scheduleableTargetIds.length === 0}
            onClick={() => onSchedule(scheduleableTargetIds)}
          >
            <CalendarClock className="w-3.5 h-3.5" /> Schedule selected
          </Button>
        </div>
      </div>

      {post.availableConnections.length === 0 ? (
        <div className="text-sm text-muted-foreground py-3">
          No social accounts connected yet.{" "}
          <Link
            href={`/app/${slug}/connections`}
            className="text-accent underline-offset-2 hover:underline"
          >
            Connect one
          </Link>{" "}
          to publish.
        </div>
      ) : (
        <div className="space-y-2">
          {post.availableConnections.map((c) => {
            const target = post.targets.find((t) => t.connectionId === c.id) ?? null;
            const isActive = !!target && target.status !== "cancelled";
            return (
              <ChannelRow
                key={c.id}
                connection={c}
                target={target}
                isActive={isActive}
                pending={pending}
                onToggle={(on) => toggleConnection(c.id, on)}
                onPublishNow={() => target && onPublishNow(target)}
                onSchedule={() => target && onSchedule([target.id])}
                onCancel={() => target && onCancelTarget(target)}
                onReset={() => target && onResetTarget(target)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChannelRow({
  connection,
  target,
  isActive,
  pending,
  onToggle,
  onPublishNow,
  onSchedule,
  onCancel,
  onReset,
}: {
  connection: AvailableConnection;
  target: Target | null;
  isActive: boolean;
  pending: boolean;
  onToggle: (on: boolean) => void;
  onPublishNow: () => void;
  onSchedule: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  const meta = TARGET_STATUS_META[target?.status ?? "pending"];
  const isPosted = target?.status === "posted";
  const isFailed = target?.status === "failed";
  const isScheduled = target?.status === "scheduled";
  const isCancelled = target?.status === "cancelled";

  return (
    <div
      className={`border rounded-lg p-3 flex items-start gap-3 ${
        isActive ? "border-border bg-background" : "border-border/40 bg-secondary/30"
      }`}
    >
      <label className="flex items-center gap-2 cursor-pointer flex-shrink-0 mt-1">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={pending || isPosted}
          className="w-4 h-4 accent-accent"
        />
      </label>

      <div
        className="w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0"
        style={{ background: `${connection.providerColor}1a`, borderColor: `${connection.providerColor}55` }}
      >
        <ProviderGlyph
          provider={connection.provider}
          className="w-4 h-4"
          style={{ color: connection.providerColor }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">
            {connection.customLabel || connection.providerName}
          </span>
          {connection.accountHandle && (
            <span className="text-xs font-mono text-muted-foreground">
              {connection.provider === "instagram" ? "@" : ""}
              {connection.accountHandle}
            </span>
          )}
          {target && <Badge variant={meta.tone}>{meta.label}</Badge>}
        </div>
        {isScheduled && target?.scheduledFor && (
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <CalendarClock className="w-3 h-3" /> {formatDate(target.scheduledFor)}
          </div>
        )}
        {isPosted && target?.postedAt && (
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Posted {formatDate(target.postedAt)}
            {target.providerUrl && (
              <a
                href={target.providerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
        {isFailed && target?.error && (
          <div className="text-xs text-destructive mt-1 flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span className="font-mono break-words">
              {target.error.slice(0, 200)}
              {target.attempts > 1 ? ` (${target.attempts} attempts)` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 gap-1 flex-wrap justify-end">
        {!isPosted && isActive && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSchedule}
            disabled={pending}
            title="Schedule this channel"
          >
            <CalendarClock className="w-3.5 h-3.5" />
          </Button>
        )}
        {!isPosted && isActive && (
          <Button
            size="sm"
            onClick={onPublishNow}
            disabled={pending}
            className="bg-emerald-600 hover:bg-emerald-600/90"
            title="Publish now"
          >
            <Send className="w-3.5 h-3.5" /> Now
          </Button>
        )}
        {(isFailed || isCancelled) && (
          <Button
            size="sm"
            variant="outline"
            onClick={onReset}
            disabled={pending}
            title="Reset to pending"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        )}
        {isScheduled && (
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={pending}
            title="Cancel schedule"
          >
            <XCircle className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ScheduleDialog({
  open,
  onOpenChange,
  onConfirm,
  defaultDate,
  targetCount,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (iso: string) => void;
  defaultDate: string | null;
  targetCount: number;
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
            <CalendarClock className="w-4 h-4 text-accent" /> Schedule
          </DialogTitle>
          <DialogDescription>
            {targetCount === 1
              ? "Set when this channel will publish."
              : `Set when these ${targetCount} channels will publish. The cron worker picks them up at the scheduled time.`}
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

function toLocalIsoForInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SlideCard({
  url,
  index,
  total,
  isStory,
  pending,
  onReplace,
  onRemove,
  onMove,
}: {
  url: string;
  index: number;
  total: number;
  isStory: boolean;
  pending: boolean;
  onReplace: (file: File) => void;
  onRemove: () => void;
  onMove: (dir: "left" | "right") => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="card-surface overflow-hidden group">
      <div className={`relative ${isStory ? "aspect-[9/16] bg-secondary" : "aspect-[4/5] bg-secondary"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`Slide ${index + 1}`} className="w-full h-full object-cover" />
        {/* Hover overlay actions: replace, remove */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            title="Replace this slide with an uploaded image"
          >
            <Upload className="w-3.5 h-3.5" /> Replace
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRemove}
            disabled={pending || total <= 1}
            className="text-destructive hover:bg-destructive/10 border-destructive/30 bg-background"
            title="Remove this slide"
          >
            <ImageMinus className="w-3.5 h-3.5" />
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onReplace(f);
            e.target.value = "";
          }}
        />
      </div>
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground">
          {total === 1 ? "Image" : `Slide ${String(index + 1).padStart(2, "0")}`}
        </span>
        <div className="flex items-center gap-1">
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => onMove("left")}
                disabled={pending || index === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Move left"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onMove("right")}
                disabled={pending || index === total - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Move right"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <a
            href={url}
            download
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-accent inline-flex items-center gap-1 ml-1"
          >
            <Download className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function AddSlideButton({
  onPick,
  disabled,
}: {
  onPick: (file: File) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        title="Upload a custom image as a new slide"
      >
        <ImagePlus className="w-3.5 h-3.5" /> Add image
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
