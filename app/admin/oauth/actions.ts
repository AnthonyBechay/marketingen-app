"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import type { SocialProvider } from "@prisma/client";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.email)) {
    throw new Error("Admin access required");
  }
  return user;
}

const credsSchema = z.object({
  provider: z.enum(["instagram", "linkedin"]),
  clientId: z.string().min(2).max(200),
  // Allow empty on update — the server preserves the existing secret.
  // Required on create.
  clientSecret: z.string().max(500),
  redirectUri: z.string().url().max(500),
});

export async function saveOAuthAppAction(input: unknown) {
  await requireAdmin();
  const parsed = credsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { provider, clientId, clientSecret, redirectUri } = parsed.data;

  const existing = await db.oAuthApp.findUnique({
    where: { provider: provider as SocialProvider },
  });

  if (!existing && !clientSecret.trim()) {
    return { error: "Client secret is required for the first save" };
  }

  await db.oAuthApp.upsert({
    where: { provider: provider as SocialProvider },
    update: {
      clientId,
      redirectUri,
      ...(clientSecret.trim() ? { clientSecret } : {}),
    },
    create: {
      provider: provider as SocialProvider,
      clientId,
      clientSecret,
      redirectUri,
    },
  });

  revalidatePath("/admin/oauth");
  return { ok: true };
}

export async function deleteOAuthAppAction(provider: SocialProvider) {
  await requireAdmin();
  await db.oAuthApp.deleteMany({ where: { provider } });
  revalidatePath("/admin/oauth");
  return { ok: true };
}
