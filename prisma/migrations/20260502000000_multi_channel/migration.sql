-- Multi-channel social publishing migration.
-- Introduces SocialConnection (replaces InstagramConnection) and PostTarget
-- (per-channel publish state). Existing IG connection rows and post publish
-- state are migrated forward; the legacy table and columns are then dropped.

-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('instagram', 'linkedin');

-- CreateEnum
CREATE TYPE "TargetStatus" AS ENUM ('pending', 'scheduled', 'publishing', 'posted', 'failed', 'cancelled');

-- CreateTable: SocialConnection
CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT,
    "accountHandle" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "meta" JSONB NOT NULL DEFAULT '{}',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialConnection_projectId_provider_key" ON "SocialConnection"("projectId", "provider");
CREATE INDEX "SocialConnection_projectId_idx" ON "SocialConnection"("projectId");

ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: PostTarget
CREATE TABLE "PostTarget" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "status" "TargetStatus" NOT NULL DEFAULT 'pending',
    "scheduledFor" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "providerPostId" TEXT,
    "providerUrl" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostTarget_postId_connectionId_key" ON "PostTarget"("postId", "connectionId");
CREATE INDEX "PostTarget_status_scheduledFor_idx" ON "PostTarget"("status", "scheduledFor");
CREATE INDEX "PostTarget_postId_idx" ON "PostTarget"("postId");

ALTER TABLE "PostTarget" ADD CONSTRAINT "PostTarget_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostTarget" ADD CONSTRAINT "PostTarget_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: copy InstagramConnection rows into SocialConnection.
-- meta carries pageId so the Instagram provider can still call Graph API.
INSERT INTO "SocialConnection" (
    "id", "projectId", "provider", "accountId", "accountName", "accountHandle",
    "accessToken", "tokenExpiresAt", "meta", "connectedAt", "lastError", "updatedAt"
)
SELECT
    "id",
    "projectId",
    'instagram'::"SocialProvider",
    "igUserId",
    "pageName",
    "igUsername",
    "accessToken",
    "tokenExpiresAt",
    jsonb_build_object('pageId', "pageId", 'pageName', "pageName", 'igUsername', "igUsername"),
    "connectedAt",
    "lastError",
    "updatedAt"
FROM "InstagramConnection";

-- Data migration: synthesize PostTarget rows for posts that already published
-- to Instagram so we don't lose history. Only posts with a non-null igMediaId
-- get a target row, and we mark them posted.
INSERT INTO "PostTarget" (
    "id", "postId", "connectionId", "provider", "status",
    "scheduledFor", "postedAt", "providerPostId", "error", "attempts",
    "lastAttemptAt", "createdAt", "updatedAt"
)
SELECT
    'mt_' || p."id" AS "id",
    p."id",
    sc."id",
    'instagram'::"SocialProvider",
    CASE
        WHEN p."status" = 'posted' OR p."igMediaId" IS NOT NULL THEN 'posted'::"TargetStatus"
        WHEN p."status" = 'scheduled' THEN 'scheduled'::"TargetStatus"
        WHEN p."status" = 'cancelled' THEN 'cancelled'::"TargetStatus"
        WHEN p."publishError" IS NOT NULL THEN 'failed'::"TargetStatus"
        ELSE 'pending'::"TargetStatus"
    END,
    p."scheduledFor",
    p."postedAt",
    p."igMediaId",
    p."publishError",
    p."publishAttempts",
    p."lastAttemptAt",
    p."createdAt",
    NOW()
FROM "Post" p
JOIN "SocialConnection" sc ON sc."projectId" = p."projectId" AND sc."provider" = 'instagram'
WHERE p."status" != 'archived';

-- Drop legacy IG-specific columns and table.
ALTER TABLE "Post"
    DROP COLUMN IF EXISTS "igMediaId",
    DROP COLUMN IF EXISTS "publishError",
    DROP COLUMN IF EXISTS "publishAttempts",
    DROP COLUMN IF EXISTS "lastAttemptAt";

DROP TABLE IF EXISTS "InstagramConnection";
