import { ConfigService } from '@nestjs/config';
import { MessageCipher } from './message-cipher';

const TEST_KEY =
  '6b0c959ff5c90c3696070967f839d1b9d8839293c82fdc4b4d3d96885de7b422';

function makeCipher(): MessageCipher {
  const config = { get: () => TEST_KEY } as unknown as ConfigService;
  return new MessageCipher(config);
}

describe('MessageCipher', () => {
  it('roundtrip: encrypt -> decrypt восстанавливает исходный текст', () => {
    const cipher = makeCipher();
    const plain = 'Привет, это тестовое сообщение чата 123!';
    const encrypted = cipher.encrypt(plain);
    expect(cipher.decrypt(encrypted)).toBe(plain);
  });

  it('два encrypt одного и того же текста дают разные буферы (случайный IV)', () => {
    const cipher = makeCipher();
    const plain = 'одинаковый текст';
    const a = cipher.encrypt(plain);
    const b = cipher.encrypt(plain);
    expect(a.equals(b)).toBe(false);
    // IV — первые 12 байт — тоже должны отличаться.
    expect(a.subarray(0, 12).equals(b.subarray(0, 12))).toBe(false);
  });

  it('подмена байта шифртекста -> decrypt бросает (authTag не совпадает)', () => {
    const cipher = makeCipher();
    const encrypted = cipher.encrypt('неприкосновенный текст');
    const tampered = Buffer.from(encrypted);
    const lastIdx = tampered.length - 1;
    tampered[lastIdx] = tampered[lastIdx] ^ 0xff;
    expect(() => cipher.decrypt(tampered)).toThrow();
  });

  it('формат буфера: iv(12) + authTag(16) + ciphertext той же длины, что plaintext (utf8)', () => {
    const cipher = makeCipher();
    const plain = 'abc';
    const encrypted = cipher.encrypt(plain);
    expect(encrypted.length).toBe(12 + 16 + Buffer.byteLength(plain, 'utf8'));
  });
});
