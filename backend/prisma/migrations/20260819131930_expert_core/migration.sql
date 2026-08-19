-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('LESS_THAN_YEAR', 'ONE_TO_THREE', 'THREE_TO_FIVE', 'FIVE_TO_TEN', 'MORE_THAN_TEN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('DRAFT', 'PENDING', 'VERIFIED');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('ACCEPTING', 'BUSY', 'NOT_ACCEPTING', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('IDENTITY', 'DIPLOMA', 'CERTIFICATES', 'QUALIFICATION');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'APPROVED', 'REUPLOAD_REQUIRED');

-- CreateTable
CREATE TABLE "experts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "experience" "ExperienceLevel" NOT NULL,
    "education" TEXT NOT NULL,
    "price_tiyn" INTEGER NOT NULL,
    "languages" TEXT[],
    "formats" TEXT[],
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "work_status" "WorkStatus" NOT NULL DEFAULT 'NOT_ACCEPTING',
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "blocked_reason" TEXT,
    "accepts_urgent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_topics" (
    "expert_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,

    CONSTRAINT "expert_topics_pkey" PRIMARY KEY ("expert_id","topic_id")
);

-- CreateTable
CREATE TABLE "expert_documents" (
    "id" TEXT NOT NULL,
    "expert_id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "file_key" TEXT NOT NULL,
    "comment" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expert_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_schedule_days" (
    "expert_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "start_min" INTEGER NOT NULL,
    "end_min" INTEGER NOT NULL,
    "break_start" INTEGER,
    "break_end" INTEGER,

    CONSTRAINT "expert_schedule_days_pkey" PRIMARY KEY ("expert_id","weekday")
);

-- CreateIndex
CREATE UNIQUE INDEX "experts_user_id_key" ON "experts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "expert_documents_expert_id_type_key" ON "expert_documents"("expert_id", "type");

-- AddForeignKey
ALTER TABLE "experts" ADD CONSTRAINT "experts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_topics" ADD CONSTRAINT "expert_topics_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "experts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_topics" ADD CONSTRAINT "expert_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_documents" ADD CONSTRAINT "expert_documents_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "experts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_schedule_days" ADD CONSTRAINT "expert_schedule_days_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "experts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
