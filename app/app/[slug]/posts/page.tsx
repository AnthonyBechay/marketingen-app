import Link from "next/link";
import { Image as ImageIcon, ArrowRight, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default async function PostsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { project } = await requireProject(slug);
  const posts = await db.post.findMany({
    where: { projectId: project.id },
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

      {posts.length === 0 ? (
        <div className="card-surface p-16 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
            <ImageIcon className="w-5 h-5 text-accent" />
          </div>
          <p className="font-medium mb-1">No posts yet</p>
          <p className="text-sm text-muted-foreground mb-6">Generate your first post to get started.</p>
          <Button asChild>
            <Link href={`/app/${slug}/generate`}>
              <Sparkles className="w-4 h-4" /> Generate first post <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((p) => {
            const urls = (p.imageUrls as string[]) ?? [];
            const cover = urls[0];
            return (
              <Link
                key={p.id}
                href={`/app/${slug}/posts/${p.id}`}
                className="card-surface group hover:border-accent/40 overflow-hidden"
              >
                <div className="aspect-[4/5] bg-secondary relative overflow-hidden">
                  {cover ? (
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
