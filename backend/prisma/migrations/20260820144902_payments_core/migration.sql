-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'HELD', 'CAPTURED', 'VOIDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConsultationPaymentStatus" AS ENUM ('UNPAID', 'HELD', 'CAPTURED', 'VOIDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING_REVIEW', 'PROCESSING', 'PAID', 'REJECTED');

-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "payment_status" "ConsultationPaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_token" TEXT NOT NULL,
    "masked_pan" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "holder_name" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "consultation_id" TEXT NOT NULL,
    "client_user_id" TEXT NOT NULL,
    "expert_id" TEXT NOT NULL,
    "payment_method_id" TEXT NOT NULL,
    "amount_tiyn" INTEGER NOT NULL,
    "discount_tiyn" INTEGER NOT NULL DEFAULT 0,
    "commission_tiyn" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider_hold_id" TEXT,
    "hold_created_at" TIMESTAMP(3),
    "rehold_count" INTEGER NOT NULL DEFAULT 0,
    "settle_attempts" INTEGER NOT NULL DEFAULT 0,
    "fail_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "debit_tiyn" INTEGER NOT NULL DEFAULT 0,
    "credit_tiyn" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "expert_id" TEXT NOT NULL,
    "amount_tiyn" INTEGER NOT NULL,
    "masked_pan" TEXT NOT NULL,
    "holder_name" TEXT NOT NULL,
    "card_token" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL,
    "reject_reason" TEXT,
    "provider_ref_id" TEXT,
    "reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_events" (
    "id" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_methods_user_id_idx" ON "payment_methods"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_consultation_id_key" ON "payments"("consultation_id");

-- CreateIndex
CREATE INDEX "payments_status_hold_created_at_idx" ON "payments"("status", "hold_created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_kind_ref_id_key" ON "ledger_transactions"("kind", "ref_id");

-- CreateIndex
CREATE INDEX "ledger_entries_account_created_at_idx" ON "ledger_entries"("account", "created_at");

-- CreateIndex
CREATE INDEX "payouts_expert_id_created_at_idx" ON "payouts"("expert_id", "created_at");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "provider_events_provider_event_id_key" ON "provider_events"("provider_event_id");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
