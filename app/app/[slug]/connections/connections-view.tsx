"use client";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Link2Off,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProviderGlyph } from "@/components/provider-glyph";
import { disconnectAction } from "./actions";
import type { SocialProvider } from "@prisma/client";

export type ConnectionRow = {
  provider: SocialProvider;
  providerName: string;
  providerColor: string;
  enabled: boolean;
  connection: {
    accountName: string | null;
    accountHandle: string | null;
    tokenExpiresAt: string | null;
    lastError: string | null;
  } | null;
};

export function ConnectionsView({
  slug,
  rows,
  userIsAdmin,
}: {
  slug: string;
  rows: ConnectionRow[];
  userIsAdmin: boolean;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <ProviderRow key={row.provider} slug={slug} row={row} userIsAdmin={userIsAdmin} />
      ))}
    </div>
  );
}

function ProviderRow({
  slug,
  row,
  userIsAdmin,
}: {
  slug: string;
  row: ConnectionRow;
  userIsAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onConnect() {
    window.location.href = `/api/oauth/${row.provider}/connect?slug=${encodeURIComponent(slug)}`;
  }

  function onDisconnect() {
    if (
      !confirm(
        `Disconnect ${row.providerName}? Any scheduled posts targeting this account will be cancelled.`,
      )
    )
      return;
    startTransition(async () => {
      try {
        await disconnectAction(slug, row.provider);
        toast.success(`${row.providerName} disconnected`);
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  if (!row.enabled) {
    return (
      <div className="card-surface p-5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
            <ProviderGlyph provider={row.provider} className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{row.providerName}</div>
            <div className="text-xs text-muted-foreground">
              {userIsAdmin
                ? "Not configured yet. Add OAuth credentials to enable connections."
                : `${row.providerName} isn't available yet — the site admin needs to configure it.`}
            </div>
          </div>
          {userIsAdmin ? (
            <Button asChild size="sm">
              <Link href={`/admin/oauth?provider=${row.provider}`}>
                <Settings className="w-3.5 h-3.5" /> Configure
              </Link>
            </Button>
          ) : (
            <Badge variant="outline">Unavailable</Badge>
          )}
        </div>
      </div>
    );
  }

  if (!row.connection) {
    return (
      <div className="card-surface p-5">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0"
            style={{ background: `${row.providerColor}1a`, borderColor: `${row.providerColor}55` }}
          >
            <ProviderGlyph provider={row.provider} className="w-5 h-5" style={{ color: row.providerColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{row.providerName}</div>
            <div className="text-sm text-muted-foreground">
              {row.provider === "instagram"
                ? "Connect a Facebook Page linked to an Instagram Business account."
                : "Connect your LinkedIn member account to post to your feed."}
            </div>
          </div>
          <Button onClick={onConnect}>
            <ProviderGlyph provider={row.provider} className="w-4 h-4" /> Connect
            <ExternalLink className="w-3 h-3 opacity-60" />
          </Button>
        </div>
      </div>
    );
  }

  // Connected.
  const expiresAt = row.connection.tokenExpiresAt ? new Date(row.connection.tokenExpiresAt) : null;
  const daysLeft = expiresAt
    ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;
  const tokenWarning = daysLeft !== null && daysLeft <= 7;

  return (
    <div className="card-surface p-5">
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0"
          style={{ background: `${row.providerColor}26`, borderColor: `${row.providerColor}66` }}
        >
          <ProviderGlyph provider={row.provider} className="w-5 h-5" style={{ color: row.providerColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold">{row.providerName}</h3>
            <Badge variant="success">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Live
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground space-y-0.5">
            {row.connection.accountHandle && (
              <div className="font-mono">
                {row.provider === "instagram" ? "@" : ""}
                {row.connection.accountHandle}
              </div>
            )}
            {row.connection.accountName && row.connection.accountName !== row.connection.accountHandle && (
              <div className="text-xs">{row.connection.accountName}</div>
            )}
            {daysLeft !== null && (
              <div className="text-xs">
                Token valid for {daysLeft} day{daysLeft === 1 ? "" : "s"}
                {tokenWarning && <span className="text-amber-400 ml-1">— refresh soon</span>}
              </div>
            )}
          </div>

          {row.connection.lastError && (
            <div className="mt-3 flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-0.5">Last error</div>
                <div className="font-mono text-[11px] opacity-80 break-words">{row.connection.lastError}</div>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onConnect} disabled={pending} title="Reconnect (refreshes token)">
            <RefreshCw className="w-3.5 h-3.5" /> Reconnect
          </Button>
          <Button variant="outline" size="sm" onClick={onDisconnect} disabled={pending}>
            <Link2Off className="w-3.5 h-3.5" /> Disconnect
          </Button>
        </div>
      </div>
    </div>
  );
}
