import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { OAuthAppForm } from "./oauth-app-form";

export default async function OAuthAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.email)) redirect("/app");

  // Build the public origin for default redirect URIs. Prefer PUBLIC_URL,
  // then NEXT_PUBLIC_BASE_URL, and finally infer it from the request — that
  // way admins on a fresh deploy get a useful default instead of a blank.
  // We deliberately reject 0.0.0.0 here since it's the server bind address
  // and never a real callback URL.
  const headerList = await headers();
  const fwdProto = headerList.get("x-forwarded-proto") ?? "https";
  const fwdHost = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const inferredFromRequest =
    fwdHost && !fwdHost.startsWith("0.0.0.0") ? `${fwdProto}://${fwdHost}` : "";
  const publicUrl =
    process.env.PUBLIC_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    inferredFromRequest;

  const apps = await db.oAuthApp.findMany();
  const ig = apps.find((a) => a.provider === "instagram");
  const li = apps.find((a) => a.provider === "linkedin");

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link
        href="/app"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="w-3 h-3" /> Back to app
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mb-1">OAuth apps</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Configure the Meta (Facebook) and LinkedIn OAuth apps that power social
        connections for everyone using this site. Once saved, end users can
        connect their personal accounts through your apps.
      </p>

      <div className="space-y-6">
        <OAuthAppForm
          provider="instagram"
          providerName="Instagram (Business Login)"
          existing={
            ig
              ? { clientId: ig.clientId, clientSecret: "(saved — leave blank to keep)", redirectUri: ig.redirectUri }
              : null
          }
          defaultRedirectUri={publicUrl ? `${publicUrl.replace(/\/$/, "")}/api/oauth/instagram/callback` : ""}
          docsUrl="https://developers.facebook.com/apps/"
          highlight={sp.provider === "instagram"}
          guide={[
            "Create a Meta app at developers.facebook.com/apps (any type works).",
            "Add the 'Instagram' product → choose 'API setup with Instagram business login' (NOT the Facebook-login one).",
            "On that setup screen, copy the 'Instagram app ID' and 'Instagram app secret' — these are what you paste below (NOT the parent Meta App ID).",
            "Under 'Business login settings → OAuth redirect URIs', add the redirect URL shown below.",
            "Request the scopes 'instagram_business_basic' and 'instagram_business_content_publish' (and the messages/comments scopes if you want those features later).",
            "End users only need an Instagram Business or Creator account — no Facebook Page required.",
          ]}
        />
        <OAuthAppForm
          provider="linkedin"
          providerName="LinkedIn"
          existing={
            li
              ? { clientId: li.clientId, clientSecret: "(saved — leave blank to keep)", redirectUri: li.redirectUri }
              : null
          }
          defaultRedirectUri={publicUrl ? `${publicUrl.replace(/\/$/, "")}/api/oauth/linkedin/callback` : ""}
          docsUrl="https://www.linkedin.com/developers/apps"
          highlight={sp.provider === "linkedin"}
          guide={[
            "Create an app at linkedin.com/developers/apps.",
            "Under 'Products', request: 'Sign In with LinkedIn using OpenID Connect' and 'Share on LinkedIn'.",
            "Under 'Auth', add the redirect URL shown below as an authorized redirect URL.",
            "Copy Client ID and Client Secret here.",
          ]}
        />
      </div>
    </div>
  );
}
