import Link from "next/link";
import { ArrowRight, Image as ImageIcon, Layers, Palette, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function ProjectOverview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { project } = await requireProject(slug);

  const [posted, drafts, queued] = await Promise.all([
    db.post.count({ where: { projectId: project.id, status: "posted" } }),
    db.post.count({ where: { projectId: project.id, status: "draft" } }),
    db.queueItem.count({ where: { projectId: project.id } }),
  ]);

  const recent = await db.post.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-10">
      <section className="grid sm:grid-cols-3 gap-4">
        <Stat label="Posted" value={posted} />
        <Stat label="Drafts" value={drafts} />
        <Stat label="In queue" value={queued} />
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <SetupCard
          icon={Palette}
          title="Brand identity"
          body="Set colors, logo, fonts, voice, and pricing anchors."
          href={`/app/${slug}/brand`}
        />
        <SetupCard
          icon={Layers}
          title="Campaign"
          body="Define content pillars, queue ideas, set tone rules. AI can help you build it."
          href={`/app/${slug}/campaign`}
        />
        <SetupCard
          icon={Sparkles}
          title="Generate a post"
          body="Pull from queue or describe an idea. AI generates and renders the slides."
          href={`/app/${slug}/generate`}
        />
        <SetupCard
          icon={ImageIcon}
          title="Posts"
          body="Browse, mark posted, or delete. Re-render any post after edits."
          href={`/app/${slug}/posts`}
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Recent posts
        </h2>
        {recent.length === 0 ? (
          <div className="card-surface p-8 text-center">
            <p className="text-muted-foreground mb-4">Nothing here yet.</p>
            <Button asChild>
              <Link href={`/app/${slug}/generate`}>
                Generate your first post <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((post) => (
              <Link
                key={post.id}
                href={`/app/${slug}/posts/${post.id}`}
                className="card-surface p-4 flex items-center justify-between hover:border-accent/40"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{post.topic}</div>
                  <div className="text-xs font-mono text-muted-foreground">{post.name}</div>
                </div>
                <div className="flex items-center gap-3">
                  {post.pillar && <Badge variant="outline">{post.pillar}</Badge>}
                  <Badge variant={post.status === "posted" ? "success" : "secondary"}>
                    {post.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-surface p-6">
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </div>
      <div className="text-4xl font-bold">{value}</div>
    </div>
  );
}

function SetupCard({
  icon: Icon,
  title,
  body,
  href,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link href={href} className="card-surface p-6 group hover:border-accent/40">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </Link>
  );
}
