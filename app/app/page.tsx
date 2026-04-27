import Link from "next/link";
import { Plus, ArrowRight, Folder } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreateProjectDialog } from "./_components/create-project-dialog";
import { formatDate } from "@/lib/utils";

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { posts: true } } },
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="eyebrow mb-2">Workspace</div>
          <h1 className="text-3xl font-bold tracking-tight">Your projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            One project per brand. Each has its own brand identity, campaign queue, and post history.
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      {projects.length === 0 ? (
        <Card className="text-center py-16">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-3">
              <Folder className="w-5 h-5 text-accent" />
            </div>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>Create your first project to set up a brand and start generating posts.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateProjectDialog>
              <span className="inline-flex items-center gap-2 px-4 h-10 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">
                <Plus className="w-4 h-4" /> Create your first project
              </span>
            </CreateProjectDialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/app/${p.slug}`}
              className="card-surface p-6 group hover:border-accent/40 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <Folder className="w-5 h-5 text-accent" />
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="font-semibold text-lg mb-1">{p.name}</h3>
              <p className="text-xs font-mono text-muted-foreground mb-4">{p.slug}</p>
              <div className="flex justify-between text-xs text-muted-foreground border-t border-border/60 pt-3">
                <span>{p._count.posts} posts</span>
                <span>{formatDate(p.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
