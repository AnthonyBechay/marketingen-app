import Link from "next/link";
import {
  ArrowRight,
  Layers,
  Palette,
  Sparkles,
  AlertTriangle,
  Plug,
  CalendarDays,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProviderGlyph } from "@/components/provider-glyph";
import { getProvider } from "@/lib/providers";
import { DeleteProjectButton } from "./_components/delete-project-button";
import { formatDate } from "@/lib/utils";

export default async function ProjectOverview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { project } = await requireProject(slug);

  const [posted, drafts, queued, scheduled, connections, recent, upcoming] = await Promise.all([
    db.post.count({ where: { projectId: project.id, status: "posted" } }),
    db.post.count({ where: { projectId: project.id, status: "draft" } }),
    db.queueItem.count({ where: { projectId: project.id } }),
    db.post.count({ where: { projectId: project.id, status: "scheduled" } }),
    db.socialConnection.findMany({
      where: { projectId: project.id },
      orderBy: { connectedAt: "asc" },
      select: { provider: true, accountHandle: true, accountName: true, lastError: true },
    }),
    db.post.findMany({
      where: { projectId: project.id, status: { in: ["posted", "draft"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.post.findMany({
      where: { projectId: project.id, status: "scheduled", scheduledFor: { not: null } },
      orderBy: { scheduledFor: "asc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-10">
      <ConnectionsStrip slug={slug} connections={connections} />

      <section className="grid sm:grid-cols-4 gap-4">
        <Stat label="Posted" value={posted} />
        <Stat label="Scheduled" value={scheduled} />
        <Stat label="Drafts" value={drafts} />
        <Stat label="In queue" value={queued} />
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <SetupCard
          icon={Sparkles}
          title="Generate a post"
          body="Pull from queue or describe an idea. AI generates and renders the slides."
          href={`/app/${slug}/generate`}
        />
        <SetupCard
          icon={CalendarDays}
          title="Calendar"
          body="See scheduled and posted across all channels in one place."
          href={`/app/${slug}/calendar`}
        />
        <SetupCard
          icon={Layers}
          title="Campaign"
          body="Define content pillars, queue ideas, set tone rules. AI can help you build it."
          href={`/app/${slug}/campaign`}
        />
        <SetupCard
          icon={Palette}
          title="Brand identity"
          body="Set colors, logo, fonts, voice, and pricing anchors."
          href={`/app/${slug}/brand`}
        />
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Upcoming scheduled
          </h2>
          <div className="space-y-2">
            {upcoming.map((post) => (
              <Link
                key={post.id}
                href={`/app/${slug}/posts/${post.id}`}
                className="card-surface p-4 flex items-center justify-between hover:border-accent/40"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{post.topic}</div>
                  <div className="text-xs font-mono text-muted-foreground">
                    {post.scheduledFor ? formatDate(post.scheduledFor) : ""}
                  </div>
                </div>
                <Badge variant="default">scheduled</Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

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

      <section className="pt-6 mt-6 border-t border-border/40">
        <div className="card-surface p-6 border-destructive/30 bg-destructive/[0.03]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-destructive/15 border border-destructive/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <h2 className="font-semibold mb-1">Danger zone</h2>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this project, its brand, campaign, idea queue, and all generated posts. R2 files under the project prefix are also removed.
                </p>
              </div>
            </div>
            <DeleteProjectButton projectId={project.id} projectName={project.name} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ConnectionsStrip({
  slug,
  connections,
}: {
  slug: string;
  connections: Array<{
    provider: "instagram" | "linkedin";
    accountHandle: string | null;
    accountName: string | null;
    lastError: string | null;
  }>;
}) {
  const errored = connections.find((c) => c.lastError);

  if (connections.length === 0) {
    return (
      <div className="card-surface p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-secondary/60 border border-border flex items-center justify-center flex-shrink-0">
            <Plug className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold mb-1">No social accounts connected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connect Instagram or LinkedIn so you can publish — manually or on schedule.
            </p>
            <Button asChild>
              <Link href={`/app/${slug}/connections`}>
                <Plug className="w-4 h-4" /> Connect an account <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-surface p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {connections.map((c) => {
            const meta = getProvider(c.provider).meta;
            return (
              <div
                key={c.provider}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                style={{ background: `${meta.color}1a`, borderColor: `${meta.color}55` }}
              >
                <ProviderGlyph
                  provider={c.provider}
                  className="w-4 h-4"
                  style={{ color: meta.color }}
                />
                <span className="text-sm font-medium">{meta.name}</span>
                {c.accountHandle && (
                  <span className="text-xs font-mono text-muted-foreground">
                    {c.provider === "instagram" ? "@" : ""}
                    {c.accountHandle}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/${slug}/connections`}>
            <Plug className="w-3.5 h-3.5" /> Manage
          </Link>
        </Button>
      </div>
      {errored && (
        <div className="mt-3 flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Connection issue:</span>{" "}
            <span className="font-mono opacity-80">{errored.lastError}</span>
          </div>
          <Link
            href={`/app/${slug}/connections`}
            className="text-xs underline whitespace-nowrap"
          >
            Fix
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  // Smaller stat cards in the wider 4-column grid.
  return (
    <div className="card-surface p-5">
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </div>
      <div className="text-3xl font-bold">{value}</div>
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

