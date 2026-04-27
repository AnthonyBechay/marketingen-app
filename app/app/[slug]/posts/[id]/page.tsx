import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { PostView } from "./post-view";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const { project } = await requireProject(slug);
  const post = await db.post.findFirst({ where: { id, projectId: project.id } });
  if (!post) notFound();

  return <PostView slug={slug} post={JSON.parse(JSON.stringify(post))} />;
}
