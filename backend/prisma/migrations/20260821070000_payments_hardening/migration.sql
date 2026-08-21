-- DropIndex
DROP INDEX "provider_events_provider_event_id_key";

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "hold_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_settle_attempt_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "payments_provider_hold_id_idx" ON "payments"("provider_hold_id");

-- CreateIndex
CREATE INDEX "payments_expert_id_status_updated_at_idx" ON "payments"("expert_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "payouts_provider_ref_id_idx" ON "payouts"("provider_ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_events_kind_provider_event_id_key" ON "provider_events"("kind", "provider_event_id");

