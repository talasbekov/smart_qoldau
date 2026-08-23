-- CreateEnum
CREATE TYPE "ProfileFieldStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "experts" ADD COLUMN     "about" TEXT,
ADD COLUMN     "about_pending" TEXT,
ADD COLUMN     "about_status" "ProfileFieldStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "moderation_comment" TEXT,
ADD COLUMN     "photo_key" TEXT,
ADD COLUMN     "photo_pending_key" TEXT,
ADD COLUMN     "photo_status" "ProfileFieldStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "experts_photo_status_idx" ON "experts"("photo_status");

-- CreateIndex
CREATE INDEX "experts_about_status_idx" ON "experts"("about_status");
