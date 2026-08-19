import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';
import { envValidationSchema } from '../config/env.validation';

describe('RedisService', () => {
  let service: RedisService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: envValidationSchema,
        }),
      ],
      providers: [RedisService],
    }).compile();
    service = moduleRef.get(RedisService);
  });

  afterAll(() => service.quit());

  it('ping -> PONG', async () => {
    expect(await service.ping()).toBe('PONG');
  });
});
