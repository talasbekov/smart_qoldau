import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MessageCipher } from '../chat/message-cipher';
import { RedisService } from '../redis/redis.service';
import { AdminTotpService } from './admin-totp.service';

// Ключ шифрования секретов — тот же приём, что у чата (AES-256-GCM).
const KEY = 'a'.repeat(64);

class FakeRedis {
  private readonly used = new Set<string>();

  async set(
    key: string,
    _value: string,
    _mode?: string,
    _ttl?: number,
    flag?: string,
  ): Promise<'OK' | null> {
    if (flag === 'NX' && this.used.has(key)) return null;
    this.used.add(key);
    return 'OK';
  }
}

describe('AdminTotpService', () => {
  let service: AdminTotpService;

  beforeEach(async () => {
    const config = new ConfigService({ CHAT_ENCRYPTION_KEY: KEY });
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminTotpService,
        { provide: MessageCipher, useValue: new MessageCipher(config) },
        { provide: RedisService, useValue: new FakeRedis() },
      ],
    }).compile();
    service = moduleRef.get(AdminTotpService);
  });

  it('секрет шифруется и расшифровывается обратно', () => {
    // В БД секрет второго фактора не должен лежать открытым: дамп базы
    // иначе делает второй фактор известным любому, кто его получил.
    const secret = service.generateSecret();
    const stored = service.encryptSecret(secret);

    expect(stored).not.toContain(secret);
    expect(service.decryptSecret(stored)).toBe(secret);
  });

  it('верный код текущего окна принимается', async () => {
    const secret = service.generateSecret();
    const code = service.generateCode(secret);

    await expect(service.verify('admin-1', secret, code)).resolves.toBe(true);
  });

  it('код из чужого секрета отклоняется', async () => {
    const secret = service.generateSecret();
    const foreign = service.generateCode(service.generateSecret());

    await expect(service.verify('admin-1', secret, foreign)).resolves.toBe(
      false,
    );
  });

  it('тот же код второй раз не принимается', async () => {
    // Перехваченный код действует ~30 секунд: без защиты от повтора этого
    // достаточно, чтобы войти следом за сотрудником.
    const secret = service.generateSecret();
    const code = service.generateCode(secret);

    await expect(service.verify('admin-1', secret, code)).resolves.toBe(true);
    await expect(service.verify('admin-1', secret, code)).resolves.toBe(false);
  });

  it('одноразовость считается по сотруднику, а не глобально', async () => {
    // Иначе два сотрудника с одинаковым кодом (совпадение раз в 10^6)
    // блокировали бы друг друга.
    const secret = service.generateSecret();
    const code = service.generateCode(secret);

    await expect(service.verify('admin-1', secret, code)).resolves.toBe(true);
    await expect(service.verify('admin-2', secret, code)).resolves.toBe(true);
  });

  it('коды восстановления генерируются разными и хешируются', () => {
    const codes = service.generateRecoveryCodes();

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.length).toBeGreaterThanOrEqual(8);
    for (const code of codes) {
      expect(service.hashRecoveryCode(code)).not.toContain(code);
    }
  });
});
