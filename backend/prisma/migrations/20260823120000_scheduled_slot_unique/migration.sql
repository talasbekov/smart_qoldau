-- Гонка двух клиентов на один слот исключается базой, а не проверкой в
-- коде: проверка-перед-вставкой под нагрузкой даёт двойную запись.
-- Частичный уникальный индекс Prisma не выражает, поэтому сырым SQL.
CREATE UNIQUE INDEX consultations_expert_slot_uq
  ON consultations (expert_id, started_at)
  WHERE status IN ('SCHEDULED', 'ACTIVE');
