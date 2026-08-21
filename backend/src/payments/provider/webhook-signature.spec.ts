import { WebhookSignature } from './webhook-signature';

describe('WebhookSignature (юнит)', () => {
  const SECRET = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6';
  const BODY = JSON.stringify({ event: 'payment.captured', id: 'pay-1' });

  it('roundtrip: sign затем verify -> true', () => {
    const signature = WebhookSignature.sign(SECRET, BODY);
    expect(WebhookSignature.verify(SECRET, BODY, signature)).toBe(true);
  });

  it('tamper тела -> verify возвращает false', () => {
    const signature = WebhookSignature.sign(SECRET, BODY);
    const tampered = JSON.stringify({ event: 'payment.captured', id: 'pay-2' });
    expect(WebhookSignature.verify(SECRET, tampered, signature)).toBe(false);
  });

  it('tamper подписи -> verify возвращает false', () => {
    const signature = WebhookSignature.sign(SECRET, BODY);
    const tampered =
      signature.slice(0, -1) + (signature.at(-1) === 'a' ? 'b' : 'a');
    expect(WebhookSignature.verify(SECRET, BODY, tampered)).toBe(false);
  });

  it('неверный секрет -> verify возвращает false', () => {
    const signature = WebhookSignature.sign(SECRET, BODY);
    const wrongSecret =
      'z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9z9';
    expect(WebhookSignature.verify(wrongSecret, BODY, signature)).toBe(false);
  });

  it('пустая/некорректная подпись -> false, не бросает', () => {
    expect(WebhookSignature.verify(SECRET, BODY, '')).toBe(false);
    expect(WebhookSignature.verify(SECRET, BODY, 'not-hex-!!')).toBe(false);
  });

  it('подпись другой длины -> false, не бросает', () => {
    const signature = WebhookSignature.sign(SECRET, BODY);
    expect(WebhookSignature.verify(SECRET, BODY, signature + 'ab')).toBe(false);
  });
});
