-- Р-16 (задача 6): экстренный broadcast рассылает PENDING-офферы ВСЕМ
-- кандидатам разом, что несовместимо со старым инвариантом "один PENDING на
-- заявку" (request_candidates_one_pending_uq). Заменяем его на инвариант
-- "один PENDING на пару (заявка, эксперт)": обычная (non-broadcast) ротация
-- offerToNext по-прежнему не может создать второй одновременный PENDING
-- ОДНОМУ эксперту этой заявки (P2002), а гейт "не более одного PENDING у
-- обычной заявки" держится логикой offerToNext (перечитка статуса SEARCHING
-- + исключение экспертов с уже существующим response) — см. комментарий в
-- requests.service.ts у offerToNext(). Второй одновременный PENDING одной
-- заявки возможен теперь ТОЛЬКО через EscalationService.broadcast().
DROP INDEX "request_candidates_one_pending_uq";

CREATE UNIQUE INDEX "request_candidates_pending_per_expert_uq" ON "request_candidates"("request_id", "expert_id") WHERE "response" = 'PENDING';
