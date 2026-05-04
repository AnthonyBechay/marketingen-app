import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { getProvider, providers } from "@/lib/providers";
import { PostView, type PostViewData } from "./post-view";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const { project } = await requireProject(slug);

  const [post, connections] = await Promise.all([
    db.post.findFirst({
      where: { id, projectId: project.id },
      include: {
        targets: {
          include: { connection: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    db.socialConnection.findMany({
      where: { projectId: project.id },
      orderBy: { connectedAt: "asc" },
    }),
  ]);
  if (!post) notFound();

  // Defensive: a target should always have its connection (FK is non-null
  // and cascades), but if a stale row sneaks through we filter rather than
  // crash the whole page render. Same for unknown providers.
  const targets = post.targets
    .filter((t) => t.connection && providers[t.provider])
    .map((t) => {
      const meta = getProvider(t.provider).meta;
      return {
        id: t.id,
        connectionId: t.connectionId,
        provider: t.provider,
        providerName: meta.name,
        providerColor: meta.color,
        accountHandle: t.connection.accountHandle,
        accountName: t.connection.accountName,
        status: t.status,
        scheduledFor: t.scheduledFor?.toISOString() ?? null,
        postedAt: t.postedAt?.toISOString() ?? null,
        providerPostId: t.providerPostId,
        providerUrl: t.providerUrl,
        error: t.error,
        attempts: t.attempts,
        lastAttemptAt: t.lastAttemptAt?.toISOString() ?? null,
      };
    });

  const availableConnections = connections
    .filter((c) => providers[c.provider])
    .map((c) => {
      const meta = getProvider(c.provider).meta;
      return {
        id: c.id,
        provider: c.provider,
        providerName: meta.name,
        providerColor: meta.color,
        accountHandle: c.accountHandle,
        accountName: c.accountName,
        customLabel: c.customLabel ?? null,
      };
    });

  const data: PostViewData = {
    id: post.id,
    name: post.name,
    topic: post.topic,
    summary: post.summary,
    pillar: post.pillar,
    format: post.format,
    caption: post.caption,
    imageUrls: Array.isArray(post.imageUrls) ? (post.imageUrls as string[]) : [],
    status: post.status,
    scheduledFor: post.scheduledFor?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    postedAt: post.postedAt?.toISOString() ?? null,
    targets,
    availableConnections,
  };

  return <PostView slug={slug} post={data} />;
}
