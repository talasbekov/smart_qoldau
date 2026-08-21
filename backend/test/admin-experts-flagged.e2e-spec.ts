import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClockService } from '../src/common/clock/clock.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { registeredExpertUser } from './utils/expert-helpers';
import { adminUser } from './utils/admin-helpers';

// E8a, задача 9: GET /v1/admin/experts/flagged — очередь экспертов ниже
// порога рейтинга (Р-20: ratingCount >= 20 && ratingAvg < 4.0), закрывает
// пробел E4 (там порог только пишется в audit_log). Номера +77103xxxxxx
// свободны (не пересекаются с другими спеками — см. grep по test/*.e2e-spec.ts
// на момент написания).
const PH_LOW = '+77103000001';
const PH_TIE_A = '+77103000002';
const PH_TIE_B = '+77103000003';
const PH_BELOW_COUNT = '+77103000004';
const PH_HEALTHY = '+77103000005';
const PH_EXACT_BOUNDARY = '+77103000006';
const ALL_PHONES = [
  PH_LOW,
  PH_TIE_A,
  PH_TIE_B,
  PH_BELOW_COUNT,
  PH_HEALTHY,
  PH_EXACT_BOUNDARY,
];

const ADMIN_EMAIL_PREFIX = 'admin-experts-flagged-e2e-';
let adminEmailSeq = 0;
function uniqueAdminEmail(tag: string): string {
  return `${ADMIN_EMAIL_PREFIX}${tag}-${Date.now()}-${adminEmailSeq++}@smartqoldau.kz`;
}

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

const fakeClock = {
  current: new Date('2026-08-21T05:00:00Z'),
  now(): Date {
    return new Date(this.current);
  },
};

let app: INestApplication;

function get(url: string, token?: string) {
  const req = request(app.getHttpServer()).get(url);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
}

describe('Очередь экспертов ниже порога рейтинга (E8a, задача 9)', () => {
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
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ entityId: { in: userIds } }, { entityId: { in: expertIds } }],
      },
    });
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: ADMIN_EMAIL_PREFIX } },
    });
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
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  // Профиль (DRAFT) без полной верификации — эндпоинт читает ratingAvg/
  // ratingCount напрямую с Expert, verificationStatus ни при чём.
  async function expertWithRating(
    phone: string,
    ratingAvg: number,
    ratingCount: number,
  ): Promise<string> {
    const { expertId } = await registeredExpertUser(app, phone, () => lastCode);
    await prisma.expert.update({
      where: { id: expertId },
      data: { ratingAvg, ratingCount },
    });
    return expertId;
  }

  async function staffWithRoles(roles: AdminRole[], tag: string) {
    return adminUser(app, roles, uniqueAdminEmail(tag));
  }

  it('ratingCount>=20 && ratingAvg<4.0 попадает в очередь; ratingCount<20 и ratingAvg=4.0 (граница) — нет; сортировка ratingAvg asc, вторичный ключ id asc; пагинация take/skip', async () => {
    const lowId = await expertWithRating(PH_LOW, 3.2, 22);
    const tieAId = await expertWithRating(PH_TIE_A, 3.8, 25);
    const tieBId = await expertWithRating(PH_TIE_B, 3.8, 26);
    const belowCountId = await expertWithRating(PH_BELOW_COUNT, 3.8, 19);
    const healthyId = await expertWithRating(PH_HEALTHY, 4.5, 50);
    const exactBoundaryId = await expertWithRating(PH_EXACT_BOUNDARY, 4.0, 30);

    const quality = await staffWithRoles([AdminRole.QUALITY_TEAM], 'quality');

    // take=100 (максимум) — вся очередь одним запросом, дальше и полный
    // список, и страницы сверяются с ним же (устойчиво к другим строкам
    // ratingCount>=20, если они уже есть в общей тестовой БД).
    const res = await get(
      '/v1/admin/experts/flagged?take=100',
      quality.token,
    ).expect(200);
    const ids = (res.body as Array<{ id: string }>).map((e) => e.id);

    expect(ids).toContain(lowId);
    expect(ids).toContain(tieAId);
    expect(ids).toContain(tieBId);
    expect(ids).not.toContain(belowCountId);
    expect(ids).not.toContain(healthyId);
    expect(ids).not.toContain(exactBoundaryId);

    // Порядок: ratingAvg по возрастанию (lowId=3.2 раньше пары 3.8);
    // при равном ratingAvg (tieA/tieB) — вторичный ключ id по возрастанию.
    const ownIds = ids.filter((id) => [lowId, tieAId, tieBId].includes(id));
    const expectedTieOrder = [tieAId, tieBId].sort();
    expect(ownIds).toEqual([lowId, ...expectedTieOrder]);

    const row = (
      res.body as Array<{ id: string; ratingAvg: number; ratingCount: number }>
    ).find((e) => e.id === lowId);
    expect(row).toMatchObject({ ratingAvg: 3.2, ratingCount: 22 });

    // Пагинация take/skip: страница должна быть срезом ТОГО ЖЕ порядка, что
    // и полная выдача (`ids`, уже проверенная выше) — сравниваем со срезом
    // `ids`, а не с жёстко ожидаемым содержимым страницы. Устойчиво к другим
    // ratingCount>=20 строкам в общей тестовой БД: даже если такая строка
    // существует и попадает на эти позиции, срез всё равно обязан совпасть с
    // тем, что вернул сам API на полном списке (паттерн ownIds выше).
    const page1 = await get(
      '/v1/admin/experts/flagged?take=1',
      quality.token,
    ).expect(200);
    expect((page1.body as Array<{ id: string }>).map((e) => e.id)).toEqual(
      ids.slice(0, 1),
    );

    const page2 = await get(
      '/v1/admin/experts/flagged?take=2&skip=1',
      quality.token,
    ).expect(200);
    expect((page2.body as Array<{ id: string }>).map((e) => e.id)).toEqual(
      ids.slice(1, 3),
    );
  });

  it('роль FINANCE_CONTROL -> 403 ADMIN_FORBIDDEN', async () => {
    const finance = await staffWithRoles(
      [AdminRole.FINANCE_CONTROL],
      'finance',
    );

    const res = await get('/v1/admin/experts/flagged', finance.token).expect(
      403,
    );
    expect(res.body.error.code).toBe('ADMIN_FORBIDDEN');
  });
});
