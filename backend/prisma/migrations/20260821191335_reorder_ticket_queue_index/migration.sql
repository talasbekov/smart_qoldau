-- DropIndex
DROP INDEX "tickets_status_team_created_at_idx";

-- CreateIndex
CREATE INDEX "tickets_team_status_created_at_idx" ON "tickets"("team", "status", "created_at");
