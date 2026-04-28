-- Add new statuses to the PostStatus enum
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'cancelled';

-- Add scheduledFor column
ALTER TABLE "Post" ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- Index for upcoming-scheduled queries
CREATE INDEX "Post_projectId_scheduledFor_idx" ON "Post"("projectId", "scheduledFor");
