-- OAuth app credential storage. One row per provider; admin-managed.

CREATE TABLE "OAuthApp" (
    "id" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthApp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthApp_provider_key" ON "OAuthApp"("provider");
