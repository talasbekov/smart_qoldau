-- Nullable lease columns keep the migration additive for existing rows.
ALTER TABLE "notification_outbox"
ADD COLUMN "lease_token" TEXT,
ADD COLUMN "lease_expires_at" TIMESTAMP(3);

-- The worker only scans pending rows. Include the ordering/lease fields so
-- finished and dead history never expands the hot claim set.
CREATE INDEX "notification_outbox_pending_claim_idx"
ON "notification_outbox"("next_attempt_at", "lease_expires_at", "id")
WHERE "sent_at" IS NULL AND "dead_at" IS NULL;
