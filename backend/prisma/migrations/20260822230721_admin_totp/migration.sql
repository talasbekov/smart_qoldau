-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "totp_enabled_at" TIMESTAMP(3),
ADD COLUMN     "totp_secret" TEXT;

-- CreateTable
CREATE TABLE "admin_recovery_codes" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_recovery_codes_code_hash_key" ON "admin_recovery_codes"("code_hash");

-- CreateIndex
CREATE INDEX "admin_recovery_codes_admin_user_id_used_at_idx" ON "admin_recovery_codes"("admin_user_id", "used_at");

-- AddForeignKey
ALTER TABLE "admin_recovery_codes" ADD CONSTRAINT "admin_recovery_codes_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
