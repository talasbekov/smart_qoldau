import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Request } from 'express';

/// Причина отказа. Ровно эти значения, а не свободный текст: по ним
/// строятся алерты, и «почти такая же» формулировка ломает фильтр.
export type WebhookRejectReason =
  | 'signature_missing'
  | 'signature_invalid'
  | 'payload_unparsable'
  | 'payload_incomplete';

/// Отклонённый вебхук обязан оставлять след.
///
/// Без него две беды сразу. Жалобу «я оплатил, а денег нет» разбирать
/// нечем, если подпись не сошлась из-за нашей же ошибки в секрете:
/// провайдер видит 401, мы — ничего. И перебор эндпоинта снаружи не виден
/// вовсе — вебхуки открыты миру по определению, guard'ов на них нет.
///
/// Пишем в лог приложения, а НЕ в provider_events. Таблица дедупа
/// уникальна по (kind, providerEventId), и запись туда данных из
/// неподписанного тела означала бы, что кто угодно может заранее
/// «занять» чужой eventId — настоящее событие с тем же id потом
/// схлопнется как повтор, и платёж потеряется. Журнал отказов не должен
/// быть управляемым снаружи.
///
/// Тело не логируется: у неподписанного запроса содержимое произвольное,
/// а у подписанного — платёжные данные. Вместо него хэш: одинаковые
/// повторы видно, содержимое не утекает.
export function logRejectedWebhook(
  logger: Logger,
  req: Pick<Request, 'ip'> & { rawBody?: Buffer },
  channel: string,
  reason: WebhookRejectReason,
): void {
  const rawBody = req.rawBody ?? Buffer.alloc(0);
  const bodyHash = createHash('sha256')
    .update(rawBody)
    .digest('hex')
    .slice(0, 16);

  logger.warn(
    `webhook rejected channel=${channel} reason=${reason} ` +
      `ip=${req.ip ?? 'unknown'} bytes=${rawBody.length} body_sha256=${bodyHash}`,
  );
}
