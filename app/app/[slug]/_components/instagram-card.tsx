"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2Off, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { disconnectInstagramAction } from "../instagram-actions";

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export type IgConnectionPublic = {
  igUsername: string | null;
  pageName: string | null;
  tokenExpiresAt: string;
  lastError: string | null;
} | null;

export function InstagramCard({
  slug,
  connection,
}: {
  slug: string;
  connection: IgConnectionPublic;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onConnect() {
    // Server-side route returns a 302 to Meta — full nav, not fetch.
    window.location.href = `/api/instagram/connect?slug=${encodeURIComponent(slug)}`;
  }

  function onDisconnect() {
    if (!confirm("Disconnect Instagram? Scheduled posts will stop publishing automatically.")) return;
    startTransition(async () => {
      try {
        await disconnectInstagramAction(slug);
        toast.success("Instagram disconnected");
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  if (!connection) {
    return (
      <div className="card-surface p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-secondary/60 border border-border flex items-center justify-center flex-shrink-0">
            <InstagramGlyph className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold mb-1">Connect Instagram</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Link this project to a Facebook Page + Instagram Business account so
              scheduled posts publish automatically. Each project gets one Instagram.
            </p>
            <Button onClick={onConnect}>
              <InstagramGlyph className="w-4 h-4" /> Connect Instagram
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const expiresAt = new Date(connection.tokenExpiresAt);
  const daysLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  const tokenWarning = daysLeft <= 7;

  return (
    <div className="card-surface p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
          <InstagramGlyph className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold">Instagram connected</h3>
            <Badge variant="success">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Live
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground space-y-0.5">
            {connection.igUsername && (
              <div className="font-mono">@{connection.igUsername}</div>
            )}
            {connection.pageName && (
              <div className="text-xs">via Facebook Page · {connection.pageName}</div>
            )}
            <div className="text-xs">
              Token valid for {daysLeft} day{daysLeft === 1 ? "" : "s"}
              {tokenWarning && (
                <span className="text-amber-400 ml-1">— refreshing soon</span>
              )}
            </div>
          </div>

          {connection.lastError && (
            <div className="mt-3 flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-0.5">Last publish error</div>
                <div className="font-mono text-[11px] opacity-80 break-words">{connection.lastError}</div>
              </div>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onDisconnect} disabled={pending}>
          <Link2Off className="w-3.5 h-3.5" /> Disconnect
        </Button>
      </div>
    </div>
  );
}
