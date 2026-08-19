-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SEARCHING', 'MATCHED', 'CANCELLED', 'NO_EXPERTS', 'CALLBACK_REQUESTED');

-- CreateEnum
CREATE TYPE "CandidateResponse" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'TIMEOUT', 'REVOKED');

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "client_user_id" TEXT NOT NULL,
    "client_code" INTEGER NOT NULL,
    "topic_id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "is_emergency" BOOLEAN NOT NULL DEFAULT false,
    "directed_expert_id" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'SEARCHING',
    "matched_expert_id" TEXT,
    "broadcast_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_candidates" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "expert_id" TEXT NOT NULL,
    "offered_at" TIMESTAMP(3) NOT NULL,
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "response" "CandidateResponse" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "request_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "user_id" TEXT NOT NULL,
    "expert_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id","expert_id")
);

-- CreateIndex
CREATE INDEX "requests_client_user_id_status_idx" ON "requests"("client_user_id", "status");

-- CreateIndex
CREATE INDEX "request_candidates_request_id_idx" ON "request_candidates"("request_id");

-- CreateIndex
CREATE INDEX "request_candidates_expert_id_response_idx" ON "request_candidates"("expert_id", "response");

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_candidates" ADD CONSTRAINT "request_candidates_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
