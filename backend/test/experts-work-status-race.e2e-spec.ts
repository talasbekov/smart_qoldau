import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ScheduledSweepService } from '../src/consultations/scheduled-sweep.service';
import { PresenceService } from '../src/presence/presence.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp } from './utils/create-app';

const LOCK_ID = 99160917;
const BARRIER_FUNCTION = 'test_expert_status_cas_barrier';
const BARRIER_TRIGGER = 'test_expert_status_cas_barrier';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Expert self-status concurrent with automatic BUSY (e2e)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let presence: PresenceService;
  let expertId: string;
  let expertUserId: string;
  let clientUserId: string;
  let topicId: string;
  let token: string;

  const patchStatus = (workStatus: string) =>
    request(app.getHttpServer())
      .patch('/v1/experts/me/work-status')
      .set('Authorization', `Bearer ${token}`)
      .send({ workStatus });

  async function cleanScenario(): Promise<void> {
    await db.consultation.deleteMany({ where: { expertId } });
    await db.requestCandidate.deleteMany({ where: { expertId } });
    await db.request.deleteMany({ where: { clientUserId } });
  }

  beforeAll(async () => {
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
    db = app.get(PrismaService);
    presence = app.get(PresenceService);
    const suffix = Date.now().toString().slice(-7);
    const expertUser = await db.user.create({
      data: { phone: `+771${suffix}01` },
    });
    const clientUser = await db.user.create({
      data: { phone: `+771${suffix}02` },
    });
    expertUserId = expertUser.id;
    clientUserId = clientUser.id;
    const expert = await db.expert.create({
      data: {
        userId: expertUserId,
        displayName: 'Status race test',
        city: 'Алматы',
        experience: 'THREE_TO_FIVE',
        education: 'Test',
        priceTiyn: 399000,
        languages: ['ru'],
        formats: ['chat'],
        verificationStatus: 'VERIFIED',
      },
    });
    expertId = expert.id;
    token = app.get(JwtService).sign({ sub: expertUserId, isGuest: false });
    topicId = (await db.topic.findFirstOrThrow()).id;

    // The trigger only pauses the CAS form used by the self-status UPDATE.
    // It changes no row, predicate, or isolation semantics.
    await db.$executeRawUnsafe(`
      CREATE FUNCTION ${BARRIER_FUNCTION}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF position('"work_status" <> CAST' in current_query()) > 0 THEN
          PERFORM pg_advisory_xact_lock(${LOCK_ID});
        END IF;
        RETURN NULL;
      END $$
    `);
    await db.$executeRawUnsafe(`
      CREATE TRIGGER ${BARRIER_TRIGGER}
      BEFORE UPDATE ON experts FOR EACH STATEMENT
      EXECUTE FUNCTION ${BARRIER_FUNCTION}()
    `);
  }, 30_000);

  beforeEach(async () => {
    await cleanScenario();
    await db.expert.update({
      where: { id: expertId },
      data: { workStatus: 'ACCEPTING' },
    });
    await presence.setAvailable(expertId);
  });

  afterAll(async () => {
    await db.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS ${BARRIER_TRIGGER} ON experts`,
    );
    await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${BARRIER_FUNCTION}()`);
    await presence.setUnavailable(expertId);
    await cleanScenario();
    await db.expertTopic.deleteMany({ where: { expertId } });
    await db.expert.delete({ where: { id: expertId } });
    await db.user.deleteMany({
      where: { id: { in: [expertUserId, clientUserId] } },
    });
    await app.close();
  });

  async function activateScheduled(): Promise<void> {
    await db.consultation.create({
      data: {
        requestId: randomUUID(),
        clientUserId,
        clientCode: 8181,
        expertId,
        topicId,
        format: 'chat',
        priceTiyn: 399000,
        status: 'SCHEDULED',
        startedAt: new Date(Date.now() - 1000),
      },
    });
    await app.get(ScheduledSweepService).tick();
  }

  async function acceptOffer(): Promise<void> {
    const helpRequest = await db.request.create({
      data: {
        clientUserId,
        clientCode: 8181,
        topicId,
        format: 'chat',
        status: 'SEARCHING',
      },
    });
    const offer = await db.requestCandidate.create({
      data: {
        requestId: helpRequest.id,
        expertId,
        offeredAt: new Date(),
        deadlineAt: new Date(Date.now() + 60_000),
      },
    });
    await request(app.getHttpServer())
      .post(`/v1/offers/${offer.id}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  }

  for (const workStatus of ['ACCEPTING', 'NOT_ACCEPTING']) {
    for (const activation of ['accept', 'scheduled'] as const) {
      it(`${activation} concurrent with ${workStatus} preserves committed BUSY`, async () => {
        const locked = deferred();
        const release = deferred();
        const holder = db.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LOCK_ID})::text`;
            locked.resolve();
            await release.promise;
          },
          { timeout: 20_000 },
        );
        await locked.promise;
        const pendingPatch = patchStatus(workStatus).then(
          (response) => response,
        );

        try {
          let waiting = false;
          for (let attempt = 0; attempt < 100; attempt += 1) {
            const rows = await db.$queryRaw<{ pid: number }[]>`
              SELECT pid
              FROM pg_stat_activity
              WHERE datname = current_database()
                AND wait_event = 'advisory'
                AND position('"work_status" <> CAST' in query) > 0
            `;
            if (rows.length > 0) {
              waiting = true;
              break;
            }
            await new Promise((done) => setTimeout(done, 10));
          }
          expect(waiting).toBe(true);

          if (activation === 'accept') await acceptOffer();
          else await activateScheduled();
          expect(
            (await db.expert.findUniqueOrThrow({ where: { id: expertId } }))
              .workStatus,
          ).toBe('BUSY');

          release.resolve();
          await holder;
          const response = await pendingPatch;
          expect(response.status).toBe(409);
          expect(response.body.error.code).toBe('EXPERT_BUSY');
          expect(
            (await db.expert.findUniqueOrThrow({ where: { id: expertId } }))
              .workStatus,
          ).toBe('BUSY');
          expect(await presence.isAvailable(expertId)).toBe(false);
        } finally {
          release.resolve();
          await holder;
          await pendingPatch;
        }
      }, 25_000);
    }
  }
});
