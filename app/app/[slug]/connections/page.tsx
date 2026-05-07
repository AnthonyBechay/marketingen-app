import { db } from "@/lib/db";
import { requireProject, getCurrentUser } from "@/lib/auth";
import { providerEnabled, PROVIDER_LIST, getProvider } from "@/lib/providers";
import { isAdmin } from "@/lib/admin";
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
  const user = await getCurrentUser();
  const userIsAdmin = isAdmin(user?.email);

  const [existing, ...enabledFlags] = await Promise.all([
    db.socialConnection.findMany({
      where: { projectId: project.id },
      orderBy: { connectedAt: "asc" },
    }),
    ...PROVIDER_LIST.map((id) => providerEnabled(id)),
  ]);

  const rows: ConnectionRow[] = PROVIDER_LIST.map((id, i) => {
    const conn = existing.find((c) => c.provider === id) ?? null;
    const meta = getProvider(id).meta;
    // Surface LinkedIn-specific author info so the UI can render the
    // "Posting as" selector. Other providers can ignore these fields.
    const cMeta = (conn?.meta as Record<string, unknown>) ?? {};
    const personUrn =
      (cMeta.personUrn as string | undefined) ??
      (conn ? `urn:li:person:${conn.accountId}` : null);
    const personName = (cMeta.personName as string | undefined) ?? conn?.accountName ?? null;
    const authorUrn = (cMeta.authorUrn as string | undefined) ?? personUrn ?? null;
    const organizations =
      (cMeta.organizations as Array<{ urn: string; id: string; name: string; vanityName: string | null }> | undefined) ??
      [];
    return {
      provider: id,
      providerName: meta.name,
      providerColor: meta.color,
      enabled: enabledFlags[i] as boolean,
      connection: conn
        ? {
            accountId: conn.accountId,
            accountName: conn.accountName,
            accountHandle: conn.accountHandle,
            customLabel: conn.customLabel,
            tokenExpiresAt: conn.tokenExpiresAt?.toISOString() ?? null,
            connectedAt: conn.connectedAt.toISOString(),
            updatedAt: conn.updatedAt.toISOString(),
            lastError: conn.lastError,
            authorUrn,
            personUrn,
            personName,
            organizations,
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
      <ConnectionsView slug={slug} rows={rows} userIsAdmin={userIsAdmin} />
    </div>
  );
}
