-- Частичный уникальный индекс: не более ОДНОГО PENDING-оффера на заявку.
-- Страхует ротацию offerToNext от гонок (sweep задачи 5 vs decline,
-- decline vs accept): проигравший параллельный create получает P2002.
-- Prisma-схема частичные индексы не выражает — индекс задан raw SQL
-- (см. комментарий у модели RequestCandidate в schema.prisma).
CREATE UNIQUE INDEX "request_candidates_one_pending_uq" ON "request_candidates"("request_id") WHERE "response" = 'PENDING';
