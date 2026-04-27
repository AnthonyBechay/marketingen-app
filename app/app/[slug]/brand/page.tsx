import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { BrandForm } from "./brand-form";

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { project } = await requireProject(slug);
  const brand = await db.brand.findUnique({ where: { projectId: project.id } });
  if (!brand) return null;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Brand identity</h2>
        <p className="text-sm text-muted-foreground">
          Configure once. The AI uses this for every generated post; the renderer paints every slide with these values.
        </p>
      </div>
      <BrandForm slug={slug} initial={JSON.parse(JSON.stringify(brand))} />
    </div>
  );
}
