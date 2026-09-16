-- Nullable columns preserve legacy mobile sends without a clientMessageId.
ALTER TABLE "chat_messages"
ADD COLUMN "sender_user_id" TEXT,
ADD COLUMN "client_message_id" UUID;

-- PostgreSQL treats NULL values as distinct, so legacy rows remain unrestricted
-- while correlated sends are atomic per consultation and authenticated actor.
CREATE UNIQUE INDEX "chat_messages_client_message_scope_uq"
ON "chat_messages"("consultation_id", "sender_user_id", "client_message_id");
