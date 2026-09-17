import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConsultationNoShowObservationService } from './consultation-no-show-observation.service';
import { ConsultationsAdminController } from './consultations-admin.controller';

const TEST_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://di:di@127.0.0.1:65432/di',
  REDIS_URL: 'redis://127.0.0.1:65433',
  JWT_SECRET: 'consultation-no-show-di-secret-32-chars',
  S3_ENDPOINT: 'http://127.0.0.1:65434',
  S3_ACCESS_KEY: 'di-access',
  S3_SECRET_KEY: 'di-secret',
  CHAT_ENCRYPTION_KEY: 'a'.repeat(64),
  LIVEKIT_API_KEY: 'di-livekit-key',
  LIVEKIT_API_SECRET: 'di-livekit-secret',
  PAYMENT_WEBHOOK_SECRET: 'p'.repeat(32),
  PAYOUT_WEBHOOK_SECRET: 'o'.repeat(32),
};

describe('Consultation no-show observation production DI', () => {
  const previous = new Map<string, string | undefined>();
  let moduleRef: TestingModule;

  beforeAll(async () => {
    for (const [key, value] of Object.entries(TEST_ENV)) {
      previous.set(key, process.env[key]);
      process.env[key] = value;
    }
    const { AppModule } = await import('../app.module');
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(RedisService)
      .useValue({})
      .compile();
  });

  afterAll(async () => {
    await moduleRef?.close();
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('resolves the registered controller and read service from AppModule', () => {
    expect(moduleRef.get(ConsultationsAdminController)).toBeInstanceOf(
      ConsultationsAdminController,
    );
    expect(moduleRef.get(ConsultationNoShowObservationService)).toBeInstanceOf(
      ConsultationNoShowObservationService,
    );
  });
});
