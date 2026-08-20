-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsultationOutcome" AS ENUM ('COMPLETED', 'CLIENT_NO_SHOW', 'CLIENT_CANCELLED', 'TECH_ISSUE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'FLAGGED', 'HIDDEN');

-- AlterTable
ALTER TABLE "experts" ADD COLUMN     "rating_avg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "client_user_id" TEXT NOT NULL,
    "client_code" INTEGER NOT NULL,
    "expert_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "is_emergency" BOOLEAN NOT NULL DEFAULT false,
    "price_tiyn" INTEGER NOT NULL,
    "planned_duration_min" INTEGER NOT NULL DEFAULT 50,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'ACTIVE',
    "outcome" "ConsultationOutcome",
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "client_joined_at" TIMESTAMP(3),
    "expert_joined_at" TIMESTAMP(3),
    "no_show_notified_at" TIMESTAMP(3),

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "consultation_id" TEXT NOT NULL,
    "sender_role" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_notes" (
    "consultation_id" TEXT NOT NULL,
    "expert_id" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expert_notes_pkey" PRIMARY KEY ("consultation_id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "consultation_id" TEXT NOT NULL,
    "client_user_id" TEXT NOT NULL,
    "expert_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "public_text" TEXT,
    "private_text" TEXT,
    "expert_reply" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "complaint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consultations_request_id_key" ON "consultations"("request_id");

-- CreateIndex
CREATE INDEX "consultations_client_user_id_status_idx" ON "consultations"("client_user_id", "status");

-- CreateIndex
CREATE INDEX "consultations_expert_id_status_idx" ON "consultations"("expert_id", "status");

-- CreateIndex
CREATE INDEX "chat_messages_consultation_id_created_at_idx" ON "chat_messages"("consultation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_consultation_id_key" ON "reviews"("consultation_id");

-- CreateIndex
CREATE INDEX "reviews_expert_id_status_idx" ON "reviews"("expert_id", "status");

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_notes" ADD CONSTRAINT "expert_notes_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
