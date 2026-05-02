import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { providerEnabled, PROVIDER_LIST, getProvider } from "@/lib/providers";
import { ConnectionsView, type ConnectionRow } from "./connections-view";
import { ConnectionsFlashToast } from "./flash-toast";

export default async function ConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ connected?: string; conn_error?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(slug);

  const existing = await db.socialConnection.findMany({
    where: { projectId: project.id },
    orderBy: { connectedAt: "asc" },
  });

  const rows: ConnectionRow[] = PROVIDER_LIST.map((id) => {
    const conn = existing.find((c) => c.provider === id) ?? null;
    const meta = getProvider(id).meta;
    return {
      provider: id,
      providerName: meta.name,
      providerColor: meta.color,
      enabled: providerEnabled(id),
      connection: conn
        ? {
            accountName: conn.accountName,
            accountHandle: conn.accountHandle,
            tokenExpiresAt: conn.tokenExpiresAt?.toISOString() ?? null,
            lastError: conn.lastError,
          }
        : null,
    };
  });

  return (
    <div>
      <ConnectionsFlashToast connected={sp.connected ?? null} errorMsg={sp.conn_error ?? null} />
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Connections</h2>
        <p className="text-sm text-muted-foreground">
          Link this project to social accounts so posts can publish — manually or on schedule.
        </p>
      </div>
      <ConnectionsView slug={slug} rows={rows} />
    </div>
  );
}
