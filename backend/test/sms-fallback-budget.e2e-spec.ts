import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ClockService } from '../src/common/clock/clock.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { OfferTimerService } from '../src/requests/offer-timer.service';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Бюджет SMS-добивки (E11a, задача 2): второе SMS тому же эксперту внутри
// cooldown не уходит, а отказ бюджета фиксируется в audit отдельным
// переходом — иначе он неотличим от доставки (smsFallbackAt проставляется
// в обоих случаях, это известное расхождение из E9).
const PH_E1 = '+77097000001';
const PH_C1 = '+77097000091';
const PH_C2 = '+77097000092';
const ALL_PHONES = [PH_E1, PH_C1, PH_C2];
const SMS_FALLBACK_TEXT = 'SmartQoldau: новая заявка, откройте приложение';

let lastCode = '';
const sentSms: { phone: string; text: string }[] = [];

class FakeSmsProvider implements SmsProvider {
  async send(phone: string, text: string): Promise<void> {
    sentSms.push({ phone, text });
    const match = text.match(/(\d{4})/);
    if (match) lastCode = match[1];
  }
}

const fakeClock = {
  current: new Date('2026-08-20T05:00:00Z'),
  now() {
    return this.current;
  },
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  },
};

describe('Бюджет SMS-fallback (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let timer: OfferTimerService;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) return;

    const experts = await prisma.expert.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);

    // Порядок удаления повторяет offer-push-fallback.e2e-spec: у эксперта
    // висят документы, расписание и темы — без них FK не отпускает строку.
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.device.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.requestCandidate.deleteMany({
      where: {
        OR: [
          { expertId: { in: expertIds } },
          { request: { clientUserId: { in: userIds } } },
        ],
      },
    });
    await prisma.request.deleteMany({
      where: { clientUserId: { in: userIds } },
    });
    await prisma.expertScheduleDay.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertDocument.deleteMany({
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

    // Ключи бюджета и presence переживают базу: без уборки второй прогон
    // спека упирался бы в cooldown, оставшийся от первого, а удалённый
    // эксперт продолжал бы считаться доступным.
    const keys = await redis.keys('sms:*');
    if (keys.length) await redis.del(...keys);
    if (expertIds.length) {
      await redis.srem('experts:available', ...expertIds);
      await redis.hdel('experts:lastseen', ...expertIds);
    }
  }

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
    timer = app.get(OfferTimerService);
  });

  beforeEach(async () => {
    fakeClock.current = new Date('2026-08-20T05:00:00Z');
    sentSms.length = 0;
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  const fallbackSmsTo = (phone: string) =>
    sentSms.filter((s) => s.phone === phone && s.text === SMS_FALLBACK_TEXT);

  async function createRequest(accessToken: string) {
    return request(app.getHttpServer())
      .post('/v1/requests')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
  }

  it('второе SMS тому же эксперту внутри cooldown не уходит и попадает в audit', async () => {
    const expert = await acceptingExpertHelper(app, PH_E1, () => lastCode);
    const first = await clientUserHelper(app, PH_C1, () => lastCode);

    await createRequest(first.accessToken);
    fakeClock.advance(11_000);
    await timer.sweep();
    expect(fallbackSmsTo(PH_E1)).toHaveLength(1);

    // Второй клиент — новый оффер тому же эксперту в пределах cooldown.
    const second = await clientUserHelper(app, PH_C2, () => lastCode);
    await createRequest(second.accessToken);
    fakeClock.advance(11_000);
    await timer.sweep();

    expect(fallbackSmsTo(PH_E1)).toHaveLength(1);

    const expertRow = await prisma.expert.findUniqueOrThrow({
      where: { id: expert.expertId },
    });
    const skipped = await prisma.auditLog.findFirst({
      where: {
        entity: 'notification',
        transition: 'notification.sms_budget_exceeded',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(skipped).not.toBeNull();
    expect((skipped!.payload as { limit?: string }).limit).toBe('cooldown');

    // Уведомление всё равно помечено обработанным: окно fallback закрыто,
    // и повторный sweep не должен возвращаться к нему.
    const notifications = await prisma.notification.findMany({
      where: { userId: expertRow.userId, type: 'offer.incoming' },
    });
    expect(notifications.every((n) => n.smsFallbackAt !== null)).toBe(true);
  });
});
