"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Trash2, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProviderGlyph } from "@/components/provider-glyph";
import { saveOAuthAppAction, deleteOAuthAppAction } from "./actions";
import type { SocialProvider } from "@prisma/client";

export function OAuthAppForm({
  provider,
  providerName,
  existing,
  defaultRedirectUri,
  docsUrl,
  guide,
  highlight,
}: {
  provider: SocialProvider;
  providerName: string;
  existing: { clientId: string; clientSecret: string; redirectUri: string } | null;
  defaultRedirectUri: string;
  docsUrl: string;
  guide: string[];
  highlight: boolean;
}) {
  const [clientId, setClientId] = useState(existing?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState(existing?.redirectUri ?? defaultRedirectUri);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function onSave() {
    if (!clientId.trim() || !redirectUri.trim()) {
      toast.error("Client ID and redirect URI are required");
      return;
    }
    if (!existing && !clientSecret.trim()) {
      toast.error("Client secret is required");
      return;
    }
    startTransition(async () => {
      const res = await saveOAuthAppAction({
        provider,
        clientId,
        // If editing and the user left secret blank, the server will reject;
        // we require a non-empty secret on every save. This is conservative —
        // it means re-pasting the secret to make changes. Fine tradeoff.
        clientSecret: clientSecret || (existing ? existing.clientSecret : ""),
        redirectUri,
      });
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${providerName} OAuth saved`);
      setClientSecret("");
    });
  }

  function onDelete() {
    if (!confirm(`Remove the saved ${providerName} OAuth app? Existing user connections keep working until their tokens expire.`)) return;
    startTransition(async () => {
      await deleteOAuthAppAction(provider);
      toast.success(`${providerName} OAuth removed`);
      setClientId("");
      setClientSecret("");
    });
  }

  function copyRedirect() {
    navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    toast.success("Redirect URI copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`card-surface p-6 ${highlight ? "ring-2 ring-accent/50" : ""}`}>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-secondary border border-border flex items-center justify-center">
            <ProviderGlyph provider={provider} className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">{providerName}</h3>
            <p className="text-xs text-muted-foreground">
              {existing ? "Configured" : "Not configured"}
            </p>
          </div>
        </div>
        <a
          href={docsUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground hover:text-accent inline-flex items-center gap-1"
        >
          Open developer dashboard <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <details className="mb-4 text-sm bg-secondary/40 border border-border/60 rounded-md">
        <summary className="cursor-pointer px-3 py-2 select-none text-muted-foreground hover:text-foreground">
          How to set this up
        </summary>
        <ol className="px-5 pb-3 pt-1 space-y-1.5 list-decimal list-outside text-sm text-muted-foreground">
          {guide.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </details>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Redirect URI</Label>
          <div className="flex gap-2">
            <Input
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              placeholder="https://your-domain.com/api/oauth/.../callback"
            />
            <Button variant="outline" size="icon" onClick={copyRedirect} title="Copy">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste this exact URL into the {providerName} app dashboard as an authorized redirect URI.
          </p>
        </div>

        <div className="space-y-1">
          <Label>{provider === "linkedin" ? "Client ID" : "App ID"}</Label>
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={provider === "linkedin" ? "77abc..." : "1234567890"}
          />
        </div>

        <div className="space-y-1">
          <Label>{provider === "linkedin" ? "Client Secret" : "App Secret"}</Label>
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={existing ? "Leave blank to keep current" : "Paste secret"}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">
            Stored in the database. Only visible to admins.
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        {existing && (
          <Button
            variant="outline"
            onClick={onDelete}
            disabled={pending}
            className="text-destructive hover:bg-destructive/10 border-destructive/30"
          >
            <Trash2 className="w-4 h-4" /> Remove
          </Button>
        )}
        <Button onClick={onSave} disabled={pending}>
          <Save className="w-4 h-4" /> {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
