import Link from "next/link";
import { Image as ImageIcon, ArrowRight, Sparkles, CalendarClock } from "lucide-react";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";

type SearchParams = { format?: string; status?: string };

const FORMAT_TABS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "single", label: "Posts" },
  { key: "carousel", label: "Carousels" },
  { key: "story", label: "Stories" },
  { key: "case-study", label: "Case studies" },
];

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "posted", label: "Posted" },
  { key: "cancelled", label: "Cancelled" },
  { key: "archived", label: "Archived" },
];

const STATUS_TONE: Record<
  string,
  "default" | "secondary" | "success" | "destructive" | "outline"
> = {
  draft: "secondary",
  scheduled: "default",
  posted: "success",
  cancelled: "destructive",
  archived: "outline",
};

type SortBucket = "Today" | "Yesterday" | "This week" | "Earlier";
function bucketFor(date: Date): SortBucket {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const ts = date.getTime();
  if (ts >= startOfToday) return "Today";
  if (ts >= startOfToday - dayMs) return "Yesterday";
  if (ts >= startOfToday - 6 * dayMs) return "This week";
  return "Earlier";
}

export default async function PostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(slug);

  const formatFilter = sp.format && sp.format !== "all" ? sp.format : undefined;
  const statusFilter = sp.status && sp.status !== "all" ? sp.status : undefined;

  // For sorting: scheduled posts sort by their scheduled date (upcoming first),
  // everything else sorts by createdAt desc.
  const allPosts = await db.post.findMany({
    where: {
      projectId: project.id,
      ...(formatFilter ? { format: formatFilter } : {}),
      ...(statusFilter
        ? { status: statusFilter as "draft" | "scheduled" | "posted" | "cancelled" | "archived" }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
  });

  // Sort: scheduled (upcoming first) → drafts (newest first) → others (newest first)
  const posts = [...allPosts].sort((a, b) => {
    const orderRank = (s: string) =>
      s === "scheduled" ? 0 : s === "draft" ? 1 : s === "posted" ? 2 : s === "cancelled" ? 3 : 4;
    const ra = orderRank(a.status);
    const rb = orderRank(b.status);
    if (ra !== rb) return ra - rb;
    if (a.status === "scheduled" && b.status === "scheduled") {
      const ta = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
      const tb = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
      return ta - tb; // soonest first
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Group by date bucket using each post's most relevant date.
  const buckets: Record<SortBucket, typeof posts> = {
    Today: [],
    Yesterday: [],
    "This week": [],
    Earlier: [],
  };
  for (const p of posts) {
    const date = p.scheduledFor
      ? new Date(p.scheduledFor)
      : p.postedAt
        ? new Date(p.postedAt)
        : new Date(p.createdAt);
    buckets[bucketFor(date)].push(p);
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Posts</h2>
          <p className="text-sm text-muted-foreground">
            Browse, schedule, mark posted, or cancel.
          </p>
        </div>
        <Button asChild>
          <Link href={`/app/${slug}/generate`}>
            <Sparkles className="w-4 h-4" /> Generate post
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <FilterGroup label="Format" tabs={FORMAT_TABS} activeKey={sp.format ?? "all"} param="format" slug={slug} otherParams={{ status: sp.status }} />
        <FilterGroup label="Status" tabs={STATUS_TABS} activeKey={sp.status ?? "all"} param="status" slug={slug} otherParams={{ format: sp.format }} />
      </div>

      {posts.length === 0 ? (
        <div className="card-surface p-16 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
            <ImageIcon className="w-5 h-5 text-accent" />
          </div>
          <p className="font-medium mb-1">
            {formatFilter || statusFilter ? "No posts match these filters" : "No posts yet"}
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            {formatFilter || statusFilter
              ? "Try widening the filter or generate a new post."
              : "Generate your first post to get started."}
          </p>
          <Button asChild>
            <Link href={`/app/${slug}/generate`}>
              <Sparkles className="w-4 h-4" /> Generate post <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {(Object.keys(buckets) as SortBucket[]).map((b) => {
            const items = buckets[b];
            if (!items.length) return null;
            return (
              <section key={b}>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{b}</h3>
                  <span className="text-xs font-mono text-muted-foreground">·</span>
                  <span className="text-xs font-mono text-muted-foreground">{items.length}</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((p) => {
                    const urls = (p.imageUrls as string[]) ?? [];
                    const cover = urls[0];
                    const isStory = p.format === "story";
                    return (
                      <Link
                        key={p.id}
                        href={`/app/${slug}/posts/${p.id}`}
                        className="card-surface group hover:border-accent/40 overflow-hidden flex flex-col"
                      >
                        <div
                          className={cn(
                            "bg-secondary relative overflow-hidden",
                            isStory ? "aspect-[9/16]" : "aspect-[4/5]",
                          )}
                        >
                          {cover ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={cover} alt={p.topic} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                              <ImageIcon className="w-8 h-8" />
                            </div>
                          )}
                          {urls.length > 1 && (
                            <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-mono">
                              {urls.length} slides
                            </div>
                          )}
                          {p.format && (
                            <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-sm rounded-full px-2 py-1 text-[10px] font-mono uppercase tracking-widest">
                              {p.format}
                            </div>
                          )}
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                          <div className="font-medium line-clamp-2 mb-2">{p.topic}</div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {p.pillar && <Badge variant="outline">{p.pillar}</Badge>}
                            <Badge variant={STATUS_TONE[p.status] ?? "secondary"}>{p.status}</Badge>
                          </div>
                          <div className="text-xs font-mono text-muted-foreground mt-auto flex items-center gap-1">
                            {p.status === "scheduled" && p.scheduledFor ? (
                              <>
                                <CalendarClock className="w-3 h-3" />
                                {formatDate(p.scheduledFor)}
                              </>
                            ) : p.status === "posted" && p.postedAt ? (
                              `Posted ${formatDate(p.postedAt)}`
                            ) : (
                              formatDate(p.createdAt)
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  tabs,
  activeKey,
  param,
  slug,
  otherParams,
}: {
  label: string;
  tabs: Array<{ key: string; label: string }>;
  activeKey: string;
  param: string;
  slug: string;
  otherParams: Record<string, string | undefined>;
}) {
  function makeHref(value: string) {
    const sp = new URLSearchParams();
    Object.entries(otherParams).forEach(([k, v]) => {
      if (v && v !== "all") sp.set(k, v);
    });
    if (value !== "all") sp.set(param, value);
    const qs = sp.toString();
    return `/app/${slug}/posts${qs ? `?${qs}` : ""}`;
  }
  return (
    <div className="flex items-center gap-1 bg-secondary/40 border border-border/60 rounded-lg p-1">
      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground px-2">
        {label}
      </span>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={makeHref(tab.key)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            activeKey === tab.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
