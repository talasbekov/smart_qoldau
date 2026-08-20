import { createHmac, timingSafeEqual } from 'crypto';

// HMAC-SHA256 подпись вебхуков (платежи/выплаты). Сравнение — timing-safe,
// чтобы не давать атакующему канал по времени ответа.
export class WebhookSignature {
  static sign(secret: string, rawBody: Buffer | string): string {
    return createHmac('sha256', secret).update(rawBody).digest('hex');
  }

  static verify(
    secret: string,
    rawBody: Buffer | string,
    signature: string,
  ): boolean {
    const expected = WebhookSignature.sign(secret, rawBody);
    const expectedBuf = Buffer.from(expected, 'hex');
    let providedBuf: Buffer;
    try {
      providedBuf = Buffer.from(signature, 'hex');
    } catch {
      return false;
    }
    if (expectedBuf.length !== providedBuf.length || providedBuf.length === 0) {
      return false;
    }
    return timingSafeEqual(expectedBuf, providedBuf);
  }
}
