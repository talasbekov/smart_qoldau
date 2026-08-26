CREATE TYPE "SubscriptionPlan" AS ENUM ('MONTH', 'YEAR');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'GRACE', 'CANCELLED', 'EXPIRED');

CREATE TABLE "subscriptions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "plan" "SubscriptionPlan" NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "current_period_end" TIMESTAMP(3) NOT NULL,
  "payment_method_id" TEXT NOT NULL,
  "renew_attempts" INTEGER NOT NULL DEFAULT 0,
  "first_failed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "subscriptions_status_current_period_end_idx"
  ON "subscriptions" ("status", "current_period_end");

-- Одна живая подписка на пользователя. EXPIRED не считается живой: история
-- подписок остаётся, а подписаться заново после истечения можно.
-- Частичный индекс Prisma не выражает, поэтому сырым SQL.
CREATE UNIQUE INDEX "subscriptions_active_uq" ON "subscriptions" ("user_id")
  WHERE "status" IN ('ACTIVE', 'GRACE', 'CANCELLED');

-- Снимок ставки комиссии на момент оплаты, в базисных пунктах:
-- 1500 = 15 % (обычная), 500 = 5 % (Premium, Р-03).
ALTER TABLE "payments" ADD COLUMN "commission_rate_bp" INTEGER NOT NULL DEFAULT 1500;
