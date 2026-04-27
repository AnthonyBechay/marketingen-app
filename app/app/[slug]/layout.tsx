import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireProject } from "@/lib/auth";
import { ProjectNav } from "./_components/project-nav";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { project } = await requireProject(slug);

  return (
    <div>
      <div className="border-b border-border/60">
        <div className="max-w-6xl mx-auto px-6 pt-6">
          <Link
            href="/app"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
          >
            <ChevronLeft className="w-3 h-3" /> All projects
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-xs font-mono text-muted-foreground">/{project.slug}</p>
          <ProjectNav slug={slug} />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-10">{children}</div>
    </div>
  );
}
