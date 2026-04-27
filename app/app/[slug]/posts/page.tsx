import Link from "next/link";
import { Image as ImageIcon, ArrowRight, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";

type SearchParams = { format?: string; status?: string };

const FORMAT_TABS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "carousel", label: "Carousels" },
  { key: "story", label: "Stories" },
  { key: "case-study", label: "Case studies" },
];

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "posted", label: "Posted" },
  { key: "archived", label: "Archived" },
];

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

  const posts = await db.post.findMany({
    where: {
      projectId: project.id,
      ...(formatFilter ? { format: formatFilter } : {}),
      ...(statusFilter
        ? { status: statusFilter as "draft" | "posted" | "archived" }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Posts</h2>
          <p className="text-sm text-muted-foreground">
            Click any post to view slides, copy the caption, mark posted, or delete.
          </p>
        </div>
        <Button asChild>
          <Link href={`/app/${slug}/generate`}>
            <Sparkles className="w-4 h-4" /> Generate post
          </Link>
        </Button>
      </div>

      {/* Filter rows */}
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((p) => {
            const urls = (p.imageUrls as string[]) ?? [];
            const cover = urls[0];
            const isStory = p.format === "story";
            return (
              <Link
                key={p.id}
                href={`/app/${slug}/posts/${p.id}`}
                className="card-surface group hover:border-accent/40 overflow-hidden"
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
                  {isStory && (
                    <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-sm rounded-full px-2 py-1 text-[10px] font-mono uppercase tracking-widest">
                      Story
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="font-medium line-clamp-2 mb-2">{p.topic}</div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {p.pillar && <Badge variant="outline">{p.pillar}</Badge>}
                    <Badge variant={p.status === "posted" ? "success" : "secondary"}>{p.status}</Badge>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">
                    {formatDate(p.createdAt)}
                  </div>
                </div>
              </Link>
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
