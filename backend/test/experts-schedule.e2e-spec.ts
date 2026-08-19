import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { ScheduleService } from '../src/schedule/schedule.service';
import { createApp } from './utils/create-app';

// Номера спека задачи 7 (E2), не пересекаются с другими спеками.
const PHONE_SC1 = '+77072000001';
const PHONE_SC2 = '+77072000002';
const PHONE_SC3 = '+77072000003';
const PHONE_SC4 = '+77072000004';
const PHONE_SC5 = '+77072000005';
const ALL_PHONES = [PHONE_SC1, PHONE_SC2, PHONE_SC3, PHONE_SC4, PHONE_SC5];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

const validExpertDto = {
  displayName: 'Айгуль С.',
  city: 'Алматы',
  experience: 'FIVE_TO_TEN',
  education: 'КазНУ им. аль-Фараби',
  priceTiyn: 399000,
  languages: ['ru', 'kz'],
  formats: ['chat', 'audio', 'video'],
  topicSlugs: ['anxiety-stress', 'burnout'],
};

interface ScheduleDayInput {
  weekday: number;
  enabled: boolean;
  startMin: number;
  endMin: number;
  breakStart?: number | null;
  breakEnd?: number | null;
}

const validDays: ScheduleDayInput[] = [
  ...[0, 1, 2, 3, 4].map((weekday) => ({
    weekday,
    enabled: true,
    startMin: 540,
    endMin: 1080,
    breakStart: 780,
    breakEnd: 810,
  })),
  ...[5, 6].map((weekday) => ({
    weekday,
    enabled: false,
    startMin: 540,
    endMin: 1080,
  })),
];

describe('Experts schedule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const experts = await prisma.expert.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);
    await prisma.expertScheduleDay.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...userIds, ...expertIds] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function registeredUser(phone: string) {
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone })
      .expect(204);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/verify-code')
      .send({ phone, code: lastCode })
      .expect(200);
    return res.body as {
      accessToken: string;
      refreshToken: string;
      user: { id: string; phone: string; isGuest: boolean };
    };
  }

  async function registeredExpertUser(phone: string) {
    const auth = await registeredUser(phone);
    await request(app.getHttpServer())
      .post('/v1/experts')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send(validExpertDto)
      .expect(201);
    return auth;
  }

  it('PUT валидного расписания -> 200; GET возвращает то же', async () => {
    const { accessToken } = await registeredExpertUser(PHONE_SC1);
    await request(app.getHttpServer())
      .put('/v1/experts/me/schedule')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ days: validDays })
      .expect(200);
    const res = await request(app.getHttpServer())
      .get('/v1/experts/me/schedule')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.days).toHaveLength(7);
    expect(res.body.days[0]).toMatchObject({
      weekday: 0,
      enabled: true,
      breakStart: 780,
    });
    expect(res.body.days[5]).toMatchObject({ weekday: 5, enabled: false });
  });

  it('GET без сохранённого расписания -> 7 дефолтных дней', async () => {
    const { accessToken } = await registeredExpertUser(PHONE_SC2);
    const res = await request(app.getHttpServer())
      .get('/v1/experts/me/schedule')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.days).toHaveLength(7);
    for (let weekday = 0; weekday < 7; weekday++) {
      expect(res.body.days[weekday]).toMatchObject({
        weekday,
        enabled: false,
        startMin: 540,
        endMin: 1080,
        breakStart: null,
        breakEnd: null,
      });
    }
  });

  it('невалидное: endMin <= startMin, перерыв вне интервала, не 7 дней, дубль weekday -> 400 SCHEDULE_INVALID', async () => {
    const { accessToken } = await registeredExpertUser(PHONE_SC3);
    const auth = { Authorization: `Bearer ${accessToken}` };

    // endMin <= startMin
    const badInterval = validDays.map((d, i) =>
      i === 0 ? { ...d, startMin: 1000, endMin: 900 } : d,
    );
    const r1 = await request(app.getHttpServer())
      .put('/v1/experts/me/schedule')
      .set(auth)
      .send({ days: badInterval })
      .expect(400);
    expect(r1.body.error.code).toBe('SCHEDULE_INVALID');

    // перерыв вне интервала
    const badBreak = validDays.map((d, i) =>
      i === 0 ? { ...d, breakStart: 500, breakEnd: 600 } : d,
    );
    const r2 = await request(app.getHttpServer())
      .put('/v1/experts/me/schedule')
      .set(auth)
      .send({ days: badBreak })
      .expect(400);
    expect(r2.body.error.code).toBe('SCHEDULE_INVALID');

    // не 7 дней — отсекается на уровне DTO (@ArrayMinSize/@ArrayMaxSize(7))
    const notSeven = validDays.slice(0, 6);
    const r3 = await request(app.getHttpServer())
      .put('/v1/experts/me/schedule')
      .set(auth)
      .send({ days: notSeven })
      .expect(400);
    expect(r3.body.error.code).toBe('VALIDATION_FAILED');

    // дубль weekday
    const dupWeekday = validDays.map((d, i) =>
      i === 6 ? { ...d, weekday: 5 } : d,
    );
    const r4 = await request(app.getHttpServer())
      .put('/v1/experts/me/schedule')
      .set(auth)
      .send({ days: dupWeekday })
      .expect(400);
    expect(r4.body.error.code).toBe('SCHEDULE_INVALID');
  });

  it('isWithinSchedule: рабочее время true, перерыв false, выключенный день false', async () => {
    const { accessToken } = await registeredExpertUser(PHONE_SC4);
    const meRes = await request(app.getHttpServer())
      .get('/v1/experts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const expertId = meRes.body.id as string;

    await request(app.getHttpServer())
      .put('/v1/experts/me/schedule')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ days: validDays })
      .expect(200);

    const scheduleService = app.get(ScheduleService);

    // Среда 2026-08-19 10:00 Asia/Almaty (UTC+5) = 05:00 UTC -> рабочее время (пн-пт, 09:00-18:00), enabled=true
    const wednesdayWorking = new Date('2026-08-19T05:00:00Z');
    expect(
      await scheduleService.isWithinSchedule(expertId, wednesdayWorking),
    ).toBe(true);

    // Среда 2026-08-19 13:10 Asia/Almaty = 08:10 UTC -> внутри перерыва 13:00-13:30
    const wednesdayBreak = new Date('2026-08-19T08:10:00Z');
    expect(
      await scheduleService.isWithinSchedule(expertId, wednesdayBreak),
    ).toBe(false);

    // Суббота 2026-08-22 10:00 Asia/Almaty = 05:00 UTC -> день выключен (enabled=false)
    const saturday = new Date('2026-08-22T05:00:00Z');
    expect(await scheduleService.isWithinSchedule(expertId, saturday)).toBe(
      false,
    );
  });

  it('PATCH availability переключает acceptsUrgent', async () => {
    const { accessToken } = await registeredExpertUser(PHONE_SC5);
    const auth = { Authorization: `Bearer ${accessToken}` };

    const res = await request(app.getHttpServer())
      .patch('/v1/experts/me/availability')
      .set(auth)
      .send({ acceptsUrgent: true })
      .expect(200);
    expect(res.body.acceptsUrgent).toBe(true);

    const me = await request(app.getHttpServer())
      .get('/v1/experts/me')
      .set(auth)
      .expect(200);
    expect(me.body.acceptsUrgent).toBe(true);

    const res2 = await request(app.getHttpServer())
      .patch('/v1/experts/me/availability')
      .set(auth)
      .send({ acceptsUrgent: false })
      .expect(200);
    expect(res2.body.acceptsUrgent).toBe(false);
  });
});
