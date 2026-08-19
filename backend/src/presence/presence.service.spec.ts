import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PresenceService } from './presence.service';
import { RedisService } from '../redis/redis.service';
import { ClockService } from '../common/clock/clock.service';
import { envValidationSchema } from '../config/env.validation';

// Паттерн подмены часов из брифа задачи 1: current + now() + advance(ms).
const fakeClock = {
  current: new Date('2026-08-19T05:00:00Z'),
  now(): Date {
    return new Date(this.current);
  },
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  },
};

describe('PresenceService', () => {
  let service: PresenceService;
  let redis: RedisService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: envValidationSchema,
        }),
      ],
      providers: [
        PresenceService,
        RedisService,
        { provide: ClockService, useValue: fakeClock },
      ],
    }).compile();
    service = moduleRef.get(PresenceService);
    redis = moduleRef.get(RedisService);
  });

  beforeEach(() => {
    fakeClock.current = new Date('2026-08-19T05:00:00Z');
  });

  afterEach(async () => {
    await redis.srem('experts:available', 'exp-test-1');
    await redis.hdel('experts:lastseen', 'exp-test-1');
  });

  afterAll(() => redis.quit());

  it('setAvailable/isAvailable/setUnavailable/listAvailable', async () => {
    await service.setAvailable('exp-test-1');
    expect(await service.isAvailable('exp-test-1')).toBe(true);
    expect(await service.listAvailable()).toContain('exp-test-1');
    await service.setUnavailable('exp-test-1');
    expect(await service.isAvailable('exp-test-1')).toBe(false);
  });

  it('listFresh: setAvailable пишет lastseen -> эксперт свежий сразу', async () => {
    await service.setAvailable('exp-test-1');
    expect(await service.listFresh()).toContain('exp-test-1');
  });

  it('listFresh: без touch спустя staleMs эксперт становится несвежим', async () => {
    await service.setAvailable('exp-test-1');
    fakeClock.advance(100_000);
    expect(await service.listFresh()).not.toContain('exp-test-1');
  });

  it('listFresh: touch обновляет lastseen -> эксперт снова свежий', async () => {
    await service.setAvailable('exp-test-1');
    fakeClock.advance(100_000);
    expect(await service.listFresh()).not.toContain('exp-test-1');
    await service.touch('exp-test-1');
    expect(await service.listFresh()).toContain('exp-test-1');
  });
});
