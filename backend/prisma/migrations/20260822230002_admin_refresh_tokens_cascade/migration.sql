-- DropForeignKey
ALTER TABLE "admin_refresh_tokens" DROP CONSTRAINT "admin_refresh_tokens_admin_user_id_fkey";

-- AddForeignKey
ALTER TABLE "admin_refresh_tokens" ADD CONSTRAINT "admin_refresh_tokens_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
