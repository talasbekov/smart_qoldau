-- Частичный индекс под sweep SMS-fallback (E11a, задача 10).
--
-- Запрос sweep'а (OfferPushFallbackService): type IN (...) AND
-- push_delivered_at IS NULL AND sms_fallback_at IS NULL AND created_at <= ?.
-- Рабочее множество — единицы строк, а таблица notifications растёт
-- монотонно: обычный трёхколоночный btree вынужден просматривать все
-- записи подходящего типа, включая давно доставленные.
--
-- Prisma не выражает частичные индексы в schema.prisma, поэтому индекс
-- создаётся SQL-ом и помечен в схеме комментарием.
CREATE INDEX IF NOT EXISTS "notifications_pending_fallback_idx"
  ON "notifications" ("created_at")
  WHERE "sms_fallback_at" IS NULL AND "push_delivered_at" IS NULL;
