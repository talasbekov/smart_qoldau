import { Prisma } from '@prisma/client';
import { ClockService } from '../src/common/clock/clock.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { OutboxService } from '../src/notifications/outbox.service';
import { OutboxSweepService } from '../src/notifications/outbox-sweep.service';
import { PushProviderPort } from '../src/notifications/provider/push-provider.port';
import { PrismaService } from '../src/prisma/prisma.service';
import { EventsService } from '../src/ws/events.service';

const TEST_USER_PREFIX = 'e28-outbox-reliability-';

class MutableClock extends ClockService {
  constructor(private current: Date) {
    super();
  }

  now(): Date {
    return this.current;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

class RecordingPushProvider extends PushProviderPort {
  readonly calls: Array<{
    token: string;
    data: Record<string, string>;
  }> = [];
  readonly failedTokens = new Set<string>();
  readonly emptyErrorTokens = new Set<string>();
  delayMs = 0;

  async send(input: {
    token: string;
    title: string;
    body: string;
    data: Record<string, string>;
    critical: boolean;
  }): Promise<{ providerMessageId: string }> {
    this.calls.push({ token: input.token, data: input.data });
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    if (this.failedTokens.has(input.token)) {
      throw new Error(`transport failed for ${input.token}`);
    }
    if (this.emptyErrorTokens.has(input.token)) {
      throw new Error();
    }
    return { providerMessageId: `push-${this.calls.length}` };
  }
}

class BlockingFirstWavePushProvider extends PushProviderPort {
  readonly calls: string[] = [];
  private readonly firstWaveStartedPromise: Promise<void>;
  private resolveFirstWaveStarted!: () => void;
  private readonly releasePromise: Promise<void>;
  private resolveRelease!: () => void;

  constructor(private readonly firstWaveSize: number) {
    super();
    this.firstWaveStartedPromise = new Promise((resolve) => {
      this.resolveFirstWaveStarted = resolve;
    });
    this.releasePromise = new Promise((resolve) => {
      this.resolveRelease = resolve;
    });
  }

  waitForFirstWave(): Promise<void> {
    return this.firstWaveStartedPromise;
  }

  release(): void {
    this.resolveRelease();
  }

  async send(input: {
    token: string;
    title: string;
    body: string;
    data: Record<string, string>;
    critical: boolean;
  }): Promise<{ providerMessageId: string }> {
    this.calls.push(input.token);
    if (this.calls.length <= this.firstWaveSize) {
      if (this.calls.length === this.firstWaveSize) {
        this.resolveFirstWaveStarted();
      }
      await this.releasePromise;
    }
    return { providerMessageId: `blocked-push-${this.calls.length}` };
  }
}

class FailingOutboxService extends OutboxService {
  override async enqueue(
    params: Parameters<OutboxService['enqueue']>[0],
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    await (
      super.enqueue as (
        value: Parameters<OutboxService['enqueue']>[0],
        tx?: Prisma.TransactionClient,
      ) => Promise<void>
    )(params, client);
    throw new Error('injected failure after outbox insert');
  }
}

describe('Notification outbox reliability (e2e)', () => {
  const prisma = new PrismaService();
  let clock: MutableClock;

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    clock = new MutableClock(new Date('2026-09-16T00:00:00.000Z'));
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  async function cleanup(): Promise<void> {
    await prisma.notificationOutbox.deleteMany({
      where: { userId: { startsWith: TEST_USER_PREFIX } },
    });
    await prisma.notification.deleteMany({
      where: { userId: { startsWith: TEST_USER_PREFIX } },
    });
    await prisma.device.deleteMany({
      where: { userId: { startsWith: TEST_USER_PREFIX } },
    });
  }

  async function seedJob(
    suffix: string,
    nextAttemptAt = clock.now(),
  ): Promise<{
    notificationId: string;
    outboxId: string;
    userId: string;
  }> {
    const userId = `${TEST_USER_PREFIX}${suffix}`;
    const notificationId = `notification-${suffix}`;
    const outboxId = `outbox-${suffix}`;
    await prisma.notification.create({
      data: {
        id: notificationId,
        userId,
        type: 'earning.credited',
        title: 'Начисление',
        body: 'Баланс пополнен',
        data: {},
        createdAt: clock.now(),
      },
    });
    await prisma.notificationOutbox.create({
      data: {
        id: outboxId,
        notificationId,
        userId,
        type: 'earning.credited',
        payload: {
          notificationId,
          type: 'earning.credited',
        },
        nextAttemptAt,
      },
    });
    return { notificationId, outboxId, userId };
  }

  it('rolls back notification and outbox together and emits nothing when enqueue fails', async () => {
    const emitted: unknown[] = [];
    const events = {
      emitToUser: (...args: unknown[]) => emitted.push(args),
    } as unknown as EventsService;
    const outbox = new FailingOutboxService(prisma, clock);
    const notifications = new NotificationsService(
      prisma,
      clock,
      events,
      outbox,
    );
    const userId = `${TEST_USER_PREFIX}atomic`;

    await notifications.dispatch(userId, 'earning.credited', {
      amountTenge: '1 000',
      amountTiyn: 100_000,
    });

    expect(await prisma.notification.count({ where: { userId } })).toBe(0);
    expect(await prisma.notificationOutbox.count({ where: { userId } })).toBe(
      0,
    );
    expect(emitted).toEqual([]);
  });

  it('two workers atomically claim one job without duplicate provider calls', async () => {
    const { notificationId, outboxId, userId } = await seedJob('two-workers');
    await prisma.device.create({
      data: { userId, platform: 'android', token: 'e28-two-workers' },
    });
    const push = new RecordingPushProvider();
    push.delayMs = 50;
    const workerA = new OutboxSweepService(prisma, clock, push);
    const workerB = new OutboxSweepService(prisma, clock, push);

    await Promise.all([workerA.tick(), workerB.tick()]);

    expect(
      push.calls.filter((call) => call.token === 'e28-two-workers'),
    ).toEqual([
      {
        token: 'e28-two-workers',
        data: { notificationId, type: 'earning.credited' },
      },
    ]);
    const settled = await prisma.notificationOutbox.findUniqueOrThrow({
      where: { id: outboxId },
    });
    expect(settled.sentAt).toEqual(clock.now());
    expect(settled.attempts).toBe(1);
  });

  it('does not acknowledge a job when any device transport fails, then retries successfully', async () => {
    const { notificationId, outboxId, userId } = await seedJob('retry');
    await prisma.device.createMany({
      data: [
        { userId, platform: 'android', token: 'e28-retry-ok' },
        { userId, platform: 'ios', token: 'e28-retry-fail' },
      ],
    });
    const push = new RecordingPushProvider();
    push.failedTokens.add('e28-retry-fail');
    const worker = new OutboxSweepService(prisma, clock, push);

    await worker.tick();

    const failed = await prisma.notificationOutbox.findUniqueOrThrow({
      where: { id: outboxId },
    });
    expect(failed.sentAt).toBeNull();
    expect(failed.deadAt).toBeNull();
    expect(failed.attempts).toBe(1);
    expect(failed.nextAttemptAt).toEqual(
      new Date(clock.now().getTime() + 2_000),
    );

    push.failedTokens.clear();
    clock.advance(2_000);
    await worker.tick();

    const sent = await prisma.notificationOutbox.findUniqueOrThrow({
      where: { id: outboxId },
    });
    expect(sent.sentAt).toEqual(clock.now());
    expect(sent.attempts).toBe(2);
    expect(new Set(push.calls.map((call) => call.data.notificationId))).toEqual(
      new Set([notificationId]),
    );
  });

  it('does not acknowledge a provider rejection whose Error message is empty', async () => {
    const { outboxId, userId } = await seedJob('empty-error');
    await prisma.device.create({
      data: { userId, platform: 'android', token: 'e28-empty-error' },
    });
    const push = new RecordingPushProvider();
    push.emptyErrorTokens.add('e28-empty-error');
    const worker = new OutboxSweepService(prisma, clock, push);

    await worker.tick();

    const failed = await prisma.notificationOutbox.findUniqueOrThrow({
      where: { id: outboxId },
    });
    expect(failed.sentAt).toBeNull();
    expect(failed.attempts).toBe(1);
    expect(failed.nextAttemptAt).toEqual(
      new Date(clock.now().getTime() + 2_000),
    );
  });

  it('does not send a queued job after another worker reclaimed and completed its expired lease', async () => {
    const oldDueAt = new Date('2000-01-01T00:00:00.000Z');
    const jobs = await Promise.all(
      Array.from({ length: 11 }, (_, index) =>
        seedJob(`stale-owner-${String(index).padStart(2, '0')}`, oldDueAt),
      ),
    );
    await prisma.device.createMany({
      data: jobs.map(({ userId }, index) => ({
        userId,
        platform: 'android',
        token: `e28-stale-owner-${index}`,
      })),
    });
    const slowPush = new BlockingFirstWavePushProvider(10);
    const staleWorker = new OutboxSweepService(prisma, clock, slowPush);
    const staleTick = staleWorker.tick();
    await slowPush.waitForFirstWave();
    const allTokens = jobs.map((_, index) => `e28-stale-owner-${index}`);
    const queuedToken = allTokens.find(
      (token) => !slowPush.calls.includes(token),
    );
    if (!queuedToken) throw new Error('expected one queued outbox job');
    const queuedJobIndex = allTokens.indexOf(queuedToken);

    clock.advance(60_001);
    const recoveryPush = new RecordingPushProvider();
    const recoveryWorker = new OutboxSweepService(prisma, clock, recoveryPush);
    await recoveryWorker.tick();
    expect(
      recoveryPush.calls.filter((call) => call.token === queuedToken),
    ).toHaveLength(1);
    const recoveredBeforeRelease =
      await prisma.notificationOutbox.findUniqueOrThrow({
        where: { id: jobs[queuedJobIndex].outboxId },
      });
    expect(recoveredBeforeRelease.sentAt).toEqual(clock.now());

    slowPush.release();
    await staleTick;

    expect(
      slowPush.calls.filter((token) => token === queuedToken),
    ).toHaveLength(0);
    const queuedJob = await prisma.notificationOutbox.findUniqueOrThrow({
      where: { id: jobs[queuedJobIndex].outboxId },
    });
    expect(queuedJob.sentAt).toEqual(clock.now());
    expect(queuedJob.attempts).toBe(1);
  });

  it('skips an active lease and recovers the job after a crashed worker lease expires', async () => {
    const { outboxId, userId } = await seedJob('lease-recovery');
    await prisma.device.create({
      data: { userId, platform: 'android', token: 'e28-lease-recovery' },
    });
    const leaseExpiresAt = new Date(clock.now().getTime() + 60_000);
    await prisma.$executeRaw`
      UPDATE notification_outbox
      SET lease_token = 'crashed-worker', lease_expires_at = ${leaseExpiresAt}
      WHERE id = ${outboxId}
    `;
    const push = new RecordingPushProvider();
    const worker = new OutboxSweepService(prisma, clock, push);

    expect(await worker.tick()).toBe(0);
    expect(push.calls).toHaveLength(0);

    clock.advance(60_001);
    expect(await worker.tick()).toBe(1);
    expect(push.calls).toHaveLength(1);
    const recovered = await prisma.notificationOutbox.findUniqueOrThrow({
      where: { id: outboxId },
    });
    expect(recovered.sentAt).toEqual(clock.now());
  });
});
