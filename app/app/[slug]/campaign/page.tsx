import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { CampaignEditor } from "./campaign-editor";

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { project } = await requireProject(slug);
  const [campaign, queue] = await Promise.all([
    db.campaign.findUnique({ where: { projectId: project.id } }),
    db.queueItem.findMany({ where: { projectId: project.id }, orderBy: { position: "asc" } }),
  ]);
  if (!campaign) return null;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Campaign</h2>
        <p className="text-sm text-muted-foreground">
          Define your strategy: goal, content pillars, tone rules, and a queue of ideas.
          Or let the AI draft a complete campaign from a brief — you can edit anything after.
        </p>
      </div>
      <CampaignEditor
        slug={slug}
        initial={JSON.parse(JSON.stringify(campaign))}
        queue={JSON.parse(JSON.stringify(queue))}
      />
    </div>
  );
}
