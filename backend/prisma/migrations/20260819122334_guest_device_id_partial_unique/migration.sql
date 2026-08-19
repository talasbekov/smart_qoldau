-- Частичный уникальный индекс: не более одного АКТИВНОГО гостя на device_id.
-- Полный unique на device_id недопустим: после конверсии device_id остаётся
-- у не-гостя, и повторный гостевой вход с того же устройства должен работать.
-- Prisma-схема частичные индексы не выражает — индекс задан raw SQL
-- (см. комментарий у поля deviceId в schema.prisma).
CREATE UNIQUE INDEX "users_device_id_guest_uq" ON "users"("device_id") WHERE "is_guest" = true;
