import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { GenerateForm } from "./generate-form";

export default async function GeneratePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { project } = await requireProject(slug);
  const queue = await db.queueItem.findMany({
    where: { projectId: project.id },
    orderBy: { position: "asc" },
    take: 5,
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Generate a post</h2>
        <p className="text-sm text-muted-foreground">
          Pull from your queue or describe an idea. The AI generates the post, the renderer creates the slides, and they upload to your R2 bucket.
        </p>
      </div>
      <GenerateForm slug={slug} nextQueue={queue.map((q) => ({ id: q.id, topic: q.topic, pillar: q.pillar }))} />
    </div>
  );
}
