"use client";
import { useState, useTransition } from "react";
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
  Pencil,
  Check,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ProviderGlyph } from "@/components/provider-glyph";
import {
  disconnectAction,
  setLinkedInAuthorAction,
  updateConnectionLabelAction,
} from "./actions";
import { formatDate } from "@/lib/utils";
import type { SocialProvider } from "@prisma/client";

export type ConnectionRow = {
  provider: SocialProvider;
  providerName: string;
  providerColor: string;
  enabled: boolean;
  connection: {
    accountId: string;
    accountName: string | null;
    accountHandle: string | null;
    customLabel: string | null;
    tokenExpiresAt: string | null;
    connectedAt: string;
    updatedAt: string;
    lastError: string | null;
    // LinkedIn "post as" identity. Null for non-LinkedIn providers.
    authorUrn: string | null;
    personUrn: string | null;
    personName: string | null;
    organizations: Array<{ urn: string; id: string; name: string; vanityName: string | null }>;
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
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(row.connection?.customLabel ?? "");
  const [showDetails, setShowDetails] = useState(false);

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

  function onSaveLabel() {
    startTransition(async () => {
      const res = await updateConnectionLabelAction(slug, row.provider, labelDraft);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Label updated");
      setEditingLabel(false);
      router.refresh();
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
            <ProviderGlyph
              provider={row.provider}
              className="w-5 h-5"
              style={{ color: row.providerColor }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{row.providerName}</div>
            <div className="text-sm text-muted-foreground">
              {row.provider === "instagram"
                ? "Connect your Instagram Business or Creator account."
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

  const c = row.connection;
  const expiresAt = c.tokenExpiresAt ? new Date(c.tokenExpiresAt) : null;
  const daysLeft = expiresAt
    ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;
  const tokenWarning = daysLeft !== null && daysLeft <= 7;
  const displayName = c.customLabel || row.providerName;

  return (
    <div className="card-surface p-5">
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0"
          style={{ background: `${row.providerColor}26`, borderColor: `${row.providerColor}66` }}
        >
          <ProviderGlyph
            provider={row.provider}
            className="w-5 h-5"
            style={{ color: row.providerColor }}
          />
        </div>
        <div className="flex-1 min-w-0">
          {editingLabel ? (
            <div className="flex items-center gap-2 mb-1">
              <Input
                autoFocus
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                placeholder={`e.g. "${row.providerName} – ${row.providerName === "Instagram" ? "Brand" : "Founder"}"`}
                maxLength={60}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveLabel();
                  if (e.key === "Escape") setEditingLabel(false);
                }}
                className="h-8 text-sm max-w-xs"
              />
              <Button size="icon" variant="default" onClick={onSaveLabel} disabled={pending}>
                <Check className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  setEditingLabel(false);
                  setLabelDraft(c.customLabel ?? "");
                }}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold">{displayName}</h3>
              <button
                type="button"
                onClick={() => setEditingLabel(true)}
                className="text-muted-foreground hover:text-foreground"
                title="Edit label"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <Badge variant="success">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Live
              </Badge>
            </div>
          )}
          <div className="text-sm text-muted-foreground space-y-0.5">
            {c.accountHandle && (
              <div className="font-mono">
                {row.provider === "instagram" ? "@" : ""}
                {c.accountHandle}
              </div>
            )}
            {c.accountName && c.accountName !== c.accountHandle && (
              <div className="text-xs">{c.accountName}</div>
            )}
            {daysLeft !== null && (
              <div className="text-xs">
                Token valid for {daysLeft} day{daysLeft === 1 ? "" : "s"}
                {tokenWarning && <span className="text-amber-400 ml-1">— refresh soon</span>}
              </div>
            )}
          </div>

          {row.provider === "linkedin" && (
            <LinkedInAuthorSelector
              slug={slug}
              personUrn={c.personUrn}
              personName={c.personName}
              organizations={c.organizations}
              authorUrn={c.authorUrn}
            />
          )}

          {c.lastError && (
            <div className="mt-3 flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-0.5">Last error</div>
                <div className="font-mono text-[11px] opacity-80 break-words">{c.lastError}</div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showDetails ? "rotate-180" : ""}`} />
            {showDetails ? "Hide details" : "Show details"}
          </button>
          {showDetails && (
            <dl className="mt-2 grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 text-xs font-mono text-muted-foreground">
              <dt>Account ID</dt>
              <dd className="break-all text-foreground/80">{c.accountId}</dd>
              <dt>Connected</dt>
              <dd className="text-foreground/80">{formatDate(c.connectedAt)}</dd>
              <dt>Last refresh</dt>
              <dd className="text-foreground/80">{formatDate(c.updatedAt)}</dd>
              {expiresAt && (
                <>
                  <dt>Token expires</dt>
                  <dd className="text-foreground/80">{formatDate(c.tokenExpiresAt!)}</dd>
                </>
              )}
            </dl>
          )}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onConnect}
            disabled={pending}
            title="Reconnect (refreshes token + re-authorizes)"
          >
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

function LinkedInAuthorSelector({
  slug,
  personUrn,
  personName,
  organizations,
  authorUrn,
}: {
  slug: string;
  personUrn: string | null;
  personName: string | null;
  organizations: Array<{ urn: string; id: string; name: string; vanityName: string | null }>;
  authorUrn: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onChange(value: string) {
    startTransition(async () => {
      const res = await setLinkedInAuthorAction(slug, value);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      const label =
        value === personUrn
          ? `personal profile${personName ? ` (${personName})` : ""}`
          : organizations.find((o) => o.urn === value)?.name ?? "selected page";
      toast.success(`Posting as ${label}`);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 border-t border-border/40 pt-3 space-y-1.5">
      <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Posting as
      </label>
      <select
        className="w-full h-9 px-2 rounded-md border border-border bg-background text-sm"
        value={authorUrn ?? personUrn ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
      >
        {personUrn && (
          <option value={personUrn}>
            Personal profile{personName ? ` — ${personName}` : ""}
          </option>
        )}
        {organizations.map((o) => (
          <option key={o.urn} value={o.urn}>
            Page — {o.name}
            {o.vanityName ? ` (linkedin.com/company/${o.vanityName})` : ""}
          </option>
        ))}
      </select>
      {organizations.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No Company Pages found. To post as a Page, your LinkedIn app needs the
          Marketing Developer Platform product approved (for the
          <code className="font-mono mx-1">r_organization_admin</code> +
          <code className="font-mono mx-1">w_organization_social</code> scopes), and
          you must be an admin of the Page. Reconnect after enabling.
        </p>
      )}
    </div>
  );
}
