-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TicketAuthorType" AS ENUM ('CLIENT', 'EXPERT', 'GUEST');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('CONSULTATIONS', 'PAYMENT', 'PAYOUTS', 'TECHNICAL', 'VERIFICATION', 'SECURITY', 'CLIENT_QUESTION', 'ACCOUNT_DATA', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketTeam" AS ENUM ('SUPPORT_OPERATOR', 'VERIFICATION_OPERATOR', 'FINANCE_CONTROL', 'QUALITY_TEAM');

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "author_type" "TicketAuthorType" NOT NULL,
    "author_user_id" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "category" "TicketCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "team" "TicketTeam" NOT NULL,
    "first_reply_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "related_consultation_id" TEXT,
    "related_payout_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "author_kind" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tickets_status_team_created_at_idx" ON "tickets"("status", "team", "created_at");

-- CreateIndex
CREATE INDEX "tickets_author_user_id_created_at_idx" ON "tickets"("author_user_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_created_at_idx" ON "ticket_messages"("ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
