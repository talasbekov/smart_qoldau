import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConsultationStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { registeredExpertUser } from './utils/expert-helpers';

// Схема плановой консультации (E6b, задача 1). Плановость — это статус, а
// не отдельный флаг и не отдельное поле времени: `startedAt` у плановой
// равен началу слота, у мгновенной — моменту матча.
const PH_E1 = '+77098800001';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    if (match) lastCode = match[1];
  }
}

describe('Схема плановой консультации (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let expertId: string;
  let userId: string;
  let topicId: string;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: PH_E1 },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (!ids.length) return;
    const experts = await prisma.expert.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);
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
    await prisma.smsCode.deleteMany({ where: { phone: PH_E1 } });
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    await cleanup();
    const registered = await registeredExpertUser(app, PH_E1, () => lastCode);
    expertId = registered.expertId;
    userId = (
      await prisma.expert.findUniqueOrThrow({ where: { id: expertId } })
    ).userId;
    topicId = (await prisma.topic.findFirstOrThrow()).id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  const consultationData = (requestId: string, status: ConsultationStatus) => ({
    requestId,
    clientUserId: userId,
    clientCode: 1234,
    expertId,
    topicId,
    format: 'chat',
    priceTiyn: 399000,
    status,
    startedAt: new Date('2026-08-25T10:00:00Z'),
  });

  it('консультация создаётся в статусе SCHEDULED с пустым remindedAt', async () => {
    const created = await prisma.consultation.create({
      data: consultationData(
        `sched-schema-${expertId}`,
        ConsultationStatus.SCHEDULED,
      ),
    });
    expect(created.status).toBe('SCHEDULED');
    expect(created.remindedAt).toBeNull();

    const read = await prisma.consultation.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(read.status).toBe('SCHEDULED');
    expect(read.startedAt.toISOString()).toBe('2026-08-25T10:00:00.000Z');
  });

  it('мгновенная консультация по-прежнему ACTIVE — регресс модели', async () => {
    const created = await prisma.consultation.create({
      data: consultationData(
        `sched-schema-active-${expertId}`,
        ConsultationStatus.ACTIVE,
      ),
    });
    expect(created.status).toBe('ACTIVE');
    expect(created.remindedAt).toBeNull();
  });

  it('исключение расписания уникально по специалисту и дате', async () => {
    const date = new Date('2026-08-26T00:00:00Z');
    await prisma.scheduleException.create({
      data: { expertId, date, isDayOff: true },
    });

    await expect(
      prisma.scheduleException.create({
        data: { expertId, date, isDayOff: false, startMin: 720, endMin: 960 },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    // Тот же специалист, другая дата — можно.
    const other = await prisma.scheduleException.create({
      data: {
        expertId,
        date: new Date('2026-08-27T00:00:00Z'),
        isDayOff: false,
        startMin: 720,
        endMin: 960,
      },
    });
    expect(other.isDayOff).toBe(false);
    expect(other.startMin).toBe(720);
  });
});
