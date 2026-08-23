-- AlterEnum
ALTER TYPE "ConsultationOutcome" ADD VALUE 'EXPERT_CANCELLED';

-- AlterEnum
ALTER TYPE "ConsultationStatus" ADD VALUE 'SCHEDULED';

-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "reminded_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "schedule_exceptions" (
    "id" TEXT NOT NULL,
    "expert_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "is_day_off" BOOLEAN NOT NULL DEFAULT true,
    "start_min" INTEGER,
    "end_min" INTEGER,

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_exceptions_expert_id_date_key" ON "schedule_exceptions"("expert_id", "date");

-- CreateIndex
CREATE INDEX "consultations_status_started_at_idx" ON "consultations"("status", "started_at");

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "experts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
