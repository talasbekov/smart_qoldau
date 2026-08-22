import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { authenticator } from 'otplib';
import { MessageCipher } from '../chat/message-cipher';
import { RedisService } from '../redis/redis.service';

// Второй фактор для сотрудников админки (E11a, задача 5).
//
// Секрет хранится ЗАШИФРОВАННЫМ тем же приёмом, что содержимое чата
// (AES-256-GCM, MessageCipher): база с открытыми секретами второго фактора
// — это второй фактор, известный любому, у кого есть дамп.
const RECOVERY_CODES = 8;
const RECOVERY_CODE_BYTES = 16;
// Окно ±1 шаг (30 с): часы телефона и сервера расходятся, и требовать
// идеального совпадения значит регулярно отказывать честному сотруднику.
// Пакет зафиксирован на otplib 12.x: 13.x — ESM-only, и jest в этом
// проекте (CommonJS-трансформ) его не грузит.
const WINDOW_STEPS = 1;

@Injectable()
export class AdminTotpService {
  constructor(
    private cipher: MessageCipher,
    private redis: RedisService,
  ) {
    authenticator.options = { window: WINDOW_STEPS };
  }

  generateSecret(): string {
    return authenticator.generateSecret();
  }

  otpauthUrl(email: string, secret: string): string {
    return authenticator.keyuri(email, 'SmartQoldau', secret);
  }

  /// Код текущего окна — нужен тестам и диагностике, в API не отдаётся.
  generateCode(secret: string): string {
    return authenticator.generate(secret);
  }

  encryptSecret(secret: string): string {
    return this.cipher.encrypt(secret).toString('base64');
  }

  decryptSecret(stored: string): string {
    return this.cipher.decrypt(Buffer.from(stored, 'base64'));
  }

  /// Проверяет код и гасит его: перехваченный код действует ~30 секунд, и
  /// без защиты от повтора этого достаточно, чтобы войти следом за
  /// сотрудником. Одноразовость считается ПО СОТРУДНИКУ — иначе совпавший
  /// код у двух человек блокировал бы одного из них.
  async verify(
    adminUserId: string,
    secret: string,
    code: string,
  ): Promise<boolean> {
    if (!authenticator.verify({ token: code, secret })) return false;

    const key = `admin:totp:used:${adminUserId}:${code}`;
    // TTL с запасом на окно ±1 шаг: 90 секунд перекрывают все три окна.
    const claimed = await this.redis.set(key, '1', 'EX', 90, 'NX');
    return claimed !== null;
  }

  generateRecoveryCodes(): string[] {
    // 16 байт = 128 бит энтропии на код. Код восстановления — полноценный
    // обход второго фактора, и коротких 40 бит (10 hex-символов) для него
    // мало: перебор такого пространства по сети реалистичен, а лимит на
    // попытки защищает только от прямолинейного брутфорса.
    return Array.from({ length: RECOVERY_CODES }, () =>
      crypto.randomBytes(RECOVERY_CODE_BYTES).toString('hex').toUpperCase(),
    );
  }

  hashRecoveryCode(code: string): string {
    return crypto
      .createHash('sha256')
      .update(code.trim().toUpperCase())
      .digest('hex');
  }
}
