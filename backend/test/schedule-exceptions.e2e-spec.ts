import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClockService } from '../src/common/clock/clock.service';
import { ScheduleService } from '../src/schedule/schedule.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import {
  putScheduleAlwaysOn,
  registeredExpertUser,
} from './utils/expert-helpers';

// Исключения расписания (E6b, задача 2). Меняют не только слоты, но и
// мгновенный матчинг: заявки не должны приходить специалисту в выходной.
const PH_E1 = '+77098900001';
const PH_E2 = '+77098900002';
const ALL_PHONES = [PH_E1, PH_E2];

// Виртуальное «сейчас»: вторник 2026-08-25, 08:00 по Алматы (03:00 UTC).
const fakeClock = {
  current: new Date('2026-08-25T03:00:00Z'),
  now(): Date {
    return new Date(this.current);
  },
};

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    if (match) lastCode = match[1];
  }
}

// Полдень по Алматы указанной даты (Алматы = UTC+5 круглый год).
const almatyNoon = (isoDate: string) => new Date(`${isoDate}T07:00:00Z`);
const almatyAt = (isoDate: string, hour: number) =>
  new Date(`${isoDate}T${String(hour - 5).padStart(2, '0')}:00:00Z`);

describe('Исключения расписания специалиста (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let schedule: ScheduleService;
  let first: { accessToken: string; expertId: string };
  let second: { accessToken: string; expertId: string };

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (!ids.length) return;
    const experts = await prisma.expert.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);
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

  const put = (token: string, date: string, body: object) =>
    request(app.getHttpServer())
      .put(`/v1/experts/me/schedule/exceptions/${date}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider)
        .overrideProvider(ClockService)
        .useValue(fakeClock),
    );
    prisma = app.get(PrismaService);
    schedule = app.get(ScheduleService);
    await cleanup();

    first = await registeredExpertUser(app, PH_E1, () => lastCode);
    await putScheduleAlwaysOn(app, first.accessToken);
    second = await registeredExpertUser(app, PH_E2, () => lastCode);
    await putScheduleAlwaysOn(app, second.accessToken);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('выходной на завтра закрывает день, послезавтра не трогает', async () => {
    await put(first.accessToken, '2026-08-26', { isDayOff: true }).expect(200);

    expect(
      await schedule.isWithinSchedule(first.expertId, almatyNoon('2026-08-26')),
    ).toBe(false);
    expect(
      await schedule.isWithinSchedule(first.expertId, almatyNoon('2026-08-27')),
    ).toBe(true);
    // Чужой специалист не задет.
    expect(
      await schedule.isWithinSchedule(
        second.expertId,
        almatyNoon('2026-08-26'),
      ),
    ).toBe(true);
  });

  it('иные часы перекрывают недельное расписание в обе стороны', async () => {
    // Недельное расписание — 24/7, исключение сужает день до 12:00–16:00.
    await put(first.accessToken, '2026-08-28', {
      isDayOff: false,
      startMin: 720,
      endMin: 960,
    }).expect(200);

    expect(
      await schedule.isWithinSchedule(
        first.expertId,
        almatyAt('2026-08-28', 13),
      ),
    ).toBe(true);
    expect(
      await schedule.isWithinSchedule(
        first.expertId,
        almatyAt('2026-08-28', 17),
      ),
    ).toBe(false);
    expect(
      await schedule.isWithinSchedule(
        first.expertId,
        almatyAt('2026-08-28', 9),
      ),
    ).toBe(false);
  });

  it('удаление исключения возвращает недельное расписание', async () => {
    await request(app.getHttpServer())
      .delete('/v1/experts/me/schedule/exceptions/2026-08-28')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(204);

    expect(
      await schedule.isWithinSchedule(
        first.expertId,
        almatyAt('2026-08-28', 9),
      ),
    ).toBe(true);

    // Идемпотентно: повторное удаление тоже 204.
    await request(app.getHttpServer())
      .delete('/v1/experts/me/schedule/exceptions/2026-08-28')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(204);
  });

  it('список отдаёт только свои исключения и только запрошенный диапазон', async () => {
    await put(second.accessToken, '2026-08-26', { isDayOff: true }).expect(200);

    const res = await request(app.getHttpServer())
      .get('/v1/experts/me/schedule/exceptions?from=2026-08-26&to=2026-08-27')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ date: '2026-08-26', isDayOff: true });
  });

  it('иные часы без границ и с перевёрнутыми границами отклоняются', async () => {
    const noBounds = await put(first.accessToken, '2026-08-29', {
      isDayOff: false,
    });
    expect(noBounds.status).toBe(400);
    expect(noBounds.body.error.code).toBe('SCHEDULE_EXCEPTION_INVALID');

    const inverted = await put(first.accessToken, '2026-08-29', {
      isDayOff: false,
      startMin: 960,
      endMin: 720,
    });
    expect(inverted.status).toBe(400);
    expect(inverted.body.error.code).toBe('SCHEDULE_EXCEPTION_INVALID');
  });

  it('дата в прошлом отклоняется', async () => {
    const res = await put(first.accessToken, '2026-08-24', { isDayOff: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SCHEDULE_EXCEPTION_PAST');
  });

  it('повторный PUT на ту же дату перезаписывает, а не падает', async () => {
    await put(first.accessToken, '2026-08-30', { isDayOff: true }).expect(200);
    const updated = await put(first.accessToken, '2026-08-30', {
      isDayOff: false,
      startMin: 600,
      endMin: 780,
    }).expect(200);

    expect(updated.body).toMatchObject({
      date: '2026-08-30',
      isDayOff: false,
      startMin: 600,
      endMin: 780,
    });
  });
});
