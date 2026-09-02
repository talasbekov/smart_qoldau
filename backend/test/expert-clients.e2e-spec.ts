// Р-27: психолог видит имя и историю встреч С НИМ. Здесь проверяются
// границы, которые нельзя нарушить: клиент без согласия не виден вовсе,
// встречи ДО согласия не показываются, телефон не отдаётся никогда,
// чужие клиенты недоступны.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    lastCode = match ? match[1] : '';
  }
}

const CLIENT_PHONE = '+77015551301';
const OTHER_PHONE = '+77015551302';

describe('Клиенты эксперта (Р-27, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let expertId = '';
  let clientId = '';
  let clientToken = '';
  let expertToken = '';

  async function login(phone: string): Promise<{ token: string; userId: string }> {
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone })
      .expect(204);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/verify-code')
      .send({ phone, code: lastCode })
      .expect(200);
    return { token: res.body.accessToken, userId: res.body.user.id };
  }

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: [CLIENT_PHONE, OTHER_PHONE] } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return;

    const experts = await prisma.expert.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);

    await prisma.expertNote.deleteMany({ where: { expertId: { in: expertIds } } });
    await prisma.consultation.deleteMany({
      where: { OR: [{ clientUserId: { in: ids } }, { expertId: { in: expertIds } }] },
    });
    await prisma.requestCandidate.deleteMany({
      where: { OR: [{ expertId: { in: expertIds } }, { request: { clientUserId: { in: ids } } }] },
    });
    await prisma.request.deleteMany({ where: { clientUserId: { in: ids } } });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanup();

    const client = await login(CLIENT_PHONE);
    clientId = client.userId;
    clientToken = client.token;

    const expertUser = await login(OTHER_PHONE);
    expertToken = expertUser.token;
    const expert = await prisma.expert.create({
      data: {
        userId: expertUser.userId,
        displayName: 'Айгуль',
        city: 'Алматы',
        experience: 'THREE_TO_FIVE',
        education: 'КазНУ',
        priceTiyn: 399000,
        languages: ['ru'],
        formats: ['chat'],
        verificationStatus: 'VERIFIED',
      },
    });
    expertId = expert.id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function makeConsultation(startedAt: Date) {
    const topic = await prisma.topic.findFirstOrThrow();
    const req = await prisma.request.create({
      data: {
        clientUserId: clientId,
        topicId: topic.id,
        format: 'chat',
        status: 'MATCHED',
        clientCode: 1234,
      },
    });
    return prisma.consultation.create({
      data: {
        requestId: req.id,
        clientUserId: clientId,
        clientCode: 1234,
        expertId,
        topicId: topic.id,
        format: 'chat',
        priceTiyn: 399000,
        plannedDurationMin: 50,
        status: 'COMPLETED',
        startedAt,
        endedAt: new Date(startedAt.getTime() + 3_000_000),
      },
    });
  }

  function acceptConsent(token: string) {
    return request(app.getHttpServer())
      .post('/v1/me/expert-visibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Айгерим' })
      .expect(200);
  }

  it('клиент без согласия не виден вовсе', async () => {
    await makeConsultation(new Date());

    const res = await request(app.getHttpServer())
      .get('/v1/experts/me/clients')
      .set('Authorization', `Bearer ${expertToken}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('встречи ДО согласия не показываются', async () => {
    await makeConsultation(new Date(Date.now() - 30 * 86_400_000));
    await acceptConsent(clientToken);

    const res = await request(app.getHttpServer())
      .get('/v1/experts/me/clients')
      .set('Authorization', `Bearer ${expertToken}`)
      .expect(200);

    // Та встреча проходила под обещанием анонимности.
    expect(res.body).toEqual([]);
  });

  it('после согласия виден с именем и числом встреч', async () => {
    await acceptConsent(clientToken);
    await makeConsultation(new Date());

    const res = await request(app.getHttpServer())
      .get('/v1/experts/me/clients')
      .set('Authorization', `Bearer ${expertToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ displayName: 'Айгерим', consultations: 1 });
  });

  it('телефон клиента не отдаётся ни в списке, ни в карточке', async () => {
    await acceptConsent(clientToken);
    await makeConsultation(new Date());

    const list = await request(app.getHttpServer())
      .get('/v1/experts/me/clients')
      .set('Authorization', `Bearer ${expertToken}`)
      .expect(200);
    const card = await request(app.getHttpServer())
      .get(`/v1/experts/me/clients/${clientId}`)
      .set('Authorization', `Bearer ${expertToken}`)
      .expect(200);

    // Телефон уводит общение из платформы и в согласие не входил.
    expect(JSON.stringify(list.body)).not.toContain('7701555');
    expect(JSON.stringify(card.body)).not.toContain('7701555');
  });

  it('карточка чужого клиента недоступна', async () => {
    await acceptConsent(clientToken);
    await makeConsultation(new Date());

    const other = await prisma.expert.findFirstOrThrow({ where: { id: expertId } });
    // Эксперт запрашивает клиента, с которым не работал: сам себя.
    await request(app.getHttpServer())
      .get(`/v1/experts/me/clients/${other.userId}`)
      .set('Authorization', `Bearer ${expertToken}`)
      .expect(404);
  });

  it('открытие карточки записывается в журнал доступа', async () => {
    await acceptConsent(clientToken);
    await makeConsultation(new Date());

    await request(app.getHttpServer())
      .get(`/v1/experts/me/clients/${clientId}`)
      .set('Authorization', `Bearer ${expertToken}`)
      .expect(200);

    // Данные стали чувствительнее — доступ к ним должен быть виден.
    const entry = await prisma.auditLog.findFirst({
      where: { transition: 'client.card_read', entityId: clientId },
    });
    expect(entry).not.toBeNull();
    expect(entry!.actorId).toBe(expertId);
  });
});
