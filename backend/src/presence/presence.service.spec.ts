import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PresenceService } from './presence.service';
import { RedisService } from '../redis/redis.service';
import { envValidationSchema } from '../config/env.validation';

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
      providers: [PresenceService, RedisService],
    }).compile();
    service = moduleRef.get(PresenceService);
    redis = moduleRef.get(RedisService);
  });

  afterEach(() => redis.srem('experts:available', 'exp-test-1'));

  afterAll(() => redis.quit());

  it('setAvailable/isAvailable/setUnavailable/listAvailable', async () => {
    await service.setAvailable('exp-test-1');
    expect(await service.isAvailable('exp-test-1')).toBe(true);
    expect(await service.listAvailable()).toContain('exp-test-1');
    await service.setUnavailable('exp-test-1');
    expect(await service.isAvailable('exp-test-1')).toBe(false);
  });
});
