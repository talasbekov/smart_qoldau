import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ClockService } from '../src/common/clock/clock.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import {
  putScheduleAlwaysOn,
  registeredExpertUser,
} from './utils/expert-helpers';
import { guestClient } from './utils/client-helpers';

// Эндпоинт слотов (E6b, задача 3). Гостевой токен принимается: выбрать
// время можно до регистрации, как и посмотреть каталог.
const PH_E1 = '+77099000001';
const PH_E2 = '+77099000002';
const ALL_PHONES = [PH_E1, PH_E2];
const GUEST_DEVICE = 'slots-e2e-guest-device';

// Понедельник 2026-08-24, 03:00 UTC = 08:00 Алматы.
const fakeClock = {
  current: new Date('2026-08-24T03:00:00Z'),
  now(): Date {
    return new Date(this.current);
  },
};

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    if (match) lastCode = match[1];
  }
}

describe('Свободные слоты специалиста (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let token: string;
  let expert: { accessToken: string; expertId: string };
  let blocked: { accessToken: string; expertId: string };

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: {
        OR: [{ phone: { in: ALL_PHONES } }, { deviceId: GUEST_DEVICE }],
      },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (!ids.length) return;
    const experts = await prisma.expert.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);
    if (expertIds.length) {
      await redis.srem('experts:available', ...expertIds);
      await redis.hdel('experts:lastseen', ...expertIds);
    }
    await prisma.consultation.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.scheduleException.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertScheduleDay.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
  }

  const slots = (expertId: string, from: string, to: string) =>
    request(app.getHttpServer())
      .get(`/v1/experts/${expertId}/slots?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider)
        .overrideProvider(ClockService)
        .useValue(fakeClock),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await cleanup();

    expert = await registeredExpertUser(app, PH_E1, () => lastCode);
    await putScheduleAlwaysOn(app, expert.accessToken);
    await prisma.expert.update({
      where: { id: expert.expertId },
      data: { verificationStatus: 'VERIFIED' },
    });
    // Рабочий день 09:00–18:00 всю неделю.
    await request(app.getHttpServer())
      .put('/v1/experts/me/schedule')
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({
        days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          enabled: true,
          startMin: 540,
          endMin: 1080,
        })),
      })
      .expect(200);

    blocked = await registeredExpertUser(app, PH_E2, () => lastCode);
    await prisma.expert.update({
      where: { id: blocked.expertId },
      data: { verificationStatus: 'VERIFIED', isBlocked: true },
    });

    token = (await guestClient(app, GUEST_DEVICE)).accessToken;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('гостевой токен принимается, слоты отдаются во времени UTC', async () => {
    const res = await slots(
      expert.expertId,
      '2026-08-25T00:00:00.000Z',
      '2026-08-25T23:59:59.000Z',
    ).expect(200);

    expect(res.body.items).toHaveLength(9);
    expect(res.body.items[0].startAt).toBe('2026-08-25T04:00:00.000Z');
  });

  it('выходной-исключение убирает день целиком', async () => {
    await request(app.getHttpServer())
      .put('/v1/experts/me/schedule/exceptions/2026-08-26')
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ isDayOff: true })
      .expect(200);

    const res = await slots(
      expert.expertId,
      '2026-08-26T00:00:00.000Z',
      '2026-08-26T23:59:59.000Z',
    ).expect(200);
    expect(res.body.items).toEqual([]);
  });

  it('диапазон шире горизонта отклоняется', async () => {
    const res = await slots(
      expert.expertId,
      '2026-08-25T00:00:00.000Z',
      '2026-09-25T00:00:00.000Z',
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SLOTS_RANGE_TOO_WIDE');
  });

  it('заблокированный специалист не раскрывается: 404', async () => {
    await slots(
      blocked.expertId,
      '2026-08-25T00:00:00.000Z',
      '2026-08-25T23:59:59.000Z',
    ).expect(404);
  });

  it('без токена — 401', async () => {
    await request(app.getHttpServer())
      .get(
        `/v1/experts/${expert.expertId}/slots?from=2026-08-25T00:00:00.000Z&to=2026-08-25T23:59:59.000Z`,
      )
      .expect(401);
  });
});
