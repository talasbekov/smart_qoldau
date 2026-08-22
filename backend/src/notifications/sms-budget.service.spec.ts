import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClockService } from '../common/clock/clock.service';
import { RedisService } from '../redis/redis.service';
import { SmsBudgetService } from './sms-budget.service';

// Фейковый Redis: держит значения и TTL в памяти, поддерживает ровно те
// операции, которыми пользуется бюджет. Настоящий Redis в юните не нужен,
// а вот проверить границы суток и cooldown — нужно.
class FakeRedis {
  private readonly values = new Map<string, number>();
  private readonly expiry = new Map<string, number>();
  now = 0;

  private alive(key: string): boolean {
    const expires = this.expiry.get(key);
    if (expires !== undefined && expires <= this.now) {
      this.values.delete(key);
      this.expiry.delete(key);
      return false;
    }
    return this.values.has(key);
  }

  async set(
    key: string,
    _value: string,
    _mode?: string,
    ttlSeconds?: number,
    flag?: string,
  ): Promise<'OK' | null> {
    if (flag === 'NX' && this.alive(key)) return null;
    this.values.set(key, 1);
    if (ttlSeconds) this.expiry.set(key, this.now + ttlSeconds * 1000);
    return 'OK';
  }

  async incr(key: string): Promise<number> {
    const next = (this.alive(key) ? this.values.get(key)! : 0) + 1;
    this.values.set(key, next);
    return next;
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    if (!this.alive(key)) return 0;
    this.expiry.set(key, this.now + ttlSeconds * 1000);
    return 1;
  }

  async ttl(key: string): Promise<number> {
    if (!this.alive(key)) return -2;
    const expires = this.expiry.get(key);
    return expires === undefined ? -1 : Math.ceil((expires - this.now) / 1000);
  }

  keysSnapshot(): string[] {
    return [...this.values.keys()];
  }
}

describe('SmsBudgetService', () => {
  let service: SmsBudgetService;
  let redis: FakeRedis;
  let clock: { now: () => Date };
  let current: Date;

  const config = new Map<string, string>();

  async function build() {
    redis = new FakeRedis();
    current = new Date('2026-08-23T05:00:00.000Z'); // 10:00 в Алматы
    clock = { now: () => current };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SmsBudgetService,
        { provide: RedisService, useValue: redis },
        { provide: ClockService, useValue: clock },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) =>
              config.get(key) ?? fallback,
          },
        },
      ],
    }).compile();
    service = moduleRef.get(SmsBudgetService);
  }

  function advance(ms: number) {
    current = new Date(current.getTime() + ms);
    redis.now += ms;
  }

  beforeEach(async () => {
    config.clear();
    await build();
  });

  it('второе SMS тому же эксперту внутри cooldown не проходит', async () => {
    // У эксперта со сломанным пушем иначе каждое предложение превращается
    // в SMS — а это прямой счёт от оператора.
    expect(await service.tryConsume('e1')).toBe(true);
    expect(await service.tryConsume('e1')).toBe(false);
  });

  it('после истечения cooldown SMS снова проходит', async () => {
    expect(await service.tryConsume('e1')).toBe(true);

    advance(301_000);

    expect(await service.tryConsume('e1')).toBe(true);
  });

  it('двадцать первое SMS за сутки эксперту не проходит', async () => {
    for (let i = 1; i <= 20; i++) {
      expect(await service.tryConsume('e1')).toBe(true);
      advance(301_000);
    }

    expect(await service.tryConsume('e1')).toBe(false);
  });

  it('исчерпанный глобальный потолок останавливает и нового эксперта', async () => {
    config.set('SMS_GLOBAL_DAILY_MAX', '2');

    expect(await service.tryConsume('e1')).toBe(true);
    expect(await service.tryConsume('e2')).toBe(true);

    expect(await service.tryConsume('e3')).toBe(false);
  });

  it('дневные счётчики считаются по границе суток Алматы, а не UTC', async () => {
    // 2026-08-23T19:30Z — это уже 00:30 24 августа в Алматы (UTC+5).
    // По UTC-суткам счётчик остался бы вчерашним, и «дневной» потолок
    // фактически сдвинулся бы на пять часов.
    config.set('SMS_EXPERT_DAILY_MAX', '1');
    current = new Date('2026-08-23T18:30:00.000Z'); // 23:30 в Алматы

    expect(await service.tryConsume('e1')).toBe(true);

    advance(3_600_000); // +1 час: 00:30 24 августа в Алматы
    expect(await service.tryConsume('e1')).toBe(true);
  });

  it('отказ по каждому уровню называет сработавший предел', async () => {
    // Вызывающему коду нужно записать в audit, ЧТО именно сработало:
    // «превышен бюджет» без уровня не диагностируется.
    config.set('SMS_GLOBAL_DAILY_MAX', '1');

    expect(await service.explainConsume('e1')).toEqual({ allowed: true });
    expect(await service.explainConsume('e1')).toEqual({
      allowed: false,
      limit: 'cooldown',
    });

    advance(301_000);
    expect(await service.explainConsume('e1')).toEqual({
      allowed: false,
      limit: 'global_daily',
    });
  });
});
