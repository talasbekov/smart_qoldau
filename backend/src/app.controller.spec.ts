import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

describe('AppController', () => {
  let appController: AppController;
  let dbQuery: jest.Mock;
  let redisPing: jest.Mock;

  beforeEach(async () => {
    dbQuery = jest.fn().mockResolvedValue(1);
    redisPing = jest.fn().mockResolvedValue('PONG');
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: { $queryRaw: dbQuery } },
        { provide: RedisService, useValue: { ping: redisPing } },
      ],
    }).compile();

    appController = module.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('returns the existing healthy contract when both dependencies respond', async () => {
      const response = createResponse();

      await expect(appController.health(response)).resolves.toEqual({
        status: 'ok',
        db: 'ok',
        redis: 'ok',
      });
      expect(response.status).not.toHaveBeenCalled();
    });

    it('returns a safe 503 health response when the database is unavailable', async () => {
      dbQuery.mockRejectedValue(
        new Error('postgres://secret@database refused'),
      );

      const response = createResponse();

      await expect(appController.health(response)).resolves.toEqual({
        status: 'unhealthy',
        db: 'fail',
        redis: 'ok',
      });
      expect(response.status).toHaveBeenCalledWith(503);
    });

    it('returns a safe 503 health response when Redis is unavailable', async () => {
      redisPing.mockRejectedValue(new Error('redis://secret@cache refused'));

      const response = createResponse();

      await expect(appController.health(response)).resolves.toEqual({
        status: 'unhealthy',
        db: 'ok',
        redis: 'fail',
      });
      expect(response.status).toHaveBeenCalledWith(503);
    });

    it('bounds a stalled check and reports healthy again after recovery', async () => {
      jest.useFakeTimers();
      const db = deferred<number>();
      dbQuery.mockReturnValue(db.promise);
      const response = createResponse();

      try {
        const timedOutHealth = appController.health(response);
        await jest.advanceTimersByTimeAsync(1_000);

        await expect(timedOutHealth).resolves.toEqual({
          status: 'unhealthy',
          db: 'fail',
          redis: 'ok',
        });
        expect(response.status).toHaveBeenCalledWith(503);

        db.resolve(1);
        await db.promise;
        await flushMicrotasks();
        dbQuery.mockResolvedValue(1);
        const recoveredResponse = createResponse();

        await expect(appController.health(recoveredResponse)).resolves.toEqual({
          status: 'ok',
          db: 'ok',
          redis: 'ok',
        });
        expect(recoveredResponse.status).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it('coalesces timed-out database probes until the stalled query settles', async () => {
      jest.useFakeTimers();
      const db = deferred<number>();
      dbQuery.mockReturnValue(db.promise);

      try {
        const concurrentChecks = Array.from({ length: 12 }, () =>
          appController.health(createResponse()),
        );
        await jest.advanceTimersByTimeAsync(1_000);

        await expect(Promise.all(concurrentChecks)).resolves.toEqual(
          Array.from({ length: 12 }, () => ({
            status: 'unhealthy',
            db: 'fail',
            redis: 'ok',
          })),
        );
        expect(dbQuery).toHaveBeenCalledTimes(1);

        const sequentialTimeout = appController.health(createResponse());
        await jest.advanceTimersByTimeAsync(1_000);
        await expect(sequentialTimeout).resolves.toMatchObject({
          status: 'unhealthy',
          db: 'fail',
        });
        expect(dbQuery).toHaveBeenCalledTimes(1);

        db.resolve(1);
        await db.promise;
        await flushMicrotasks();
        dbQuery.mockResolvedValue(1);

        await expect(appController.health(createResponse())).resolves.toEqual({
          status: 'ok',
          db: 'ok',
          redis: 'ok',
        });
        expect(dbQuery).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('coalesces timed-out Redis probes and safely recovers after a late rejection', async () => {
      jest.useFakeTimers();
      const redis = deferred<string>();
      redisPing.mockReturnValue(redis.promise);
      const unhandledRejections: unknown[] = [];
      const onUnhandledRejection = (reason: unknown) =>
        unhandledRejections.push(reason);
      process.on('unhandledRejection', onUnhandledRejection);

      try {
        const concurrentChecks = Array.from({ length: 12 }, () =>
          appController.health(createResponse()),
        );
        await jest.advanceTimersByTimeAsync(1_000);
        await Promise.all(concurrentChecks);
        expect(redisPing).toHaveBeenCalledTimes(1);

        const sequentialTimeout = appController.health(createResponse());
        await jest.advanceTimersByTimeAsync(1_000);
        await sequentialTimeout;
        expect(redisPing).toHaveBeenCalledTimes(1);

        redis.reject(new Error('redis://secret@cache refused late'));
        await expect(redis.promise).rejects.toThrow('refused late');
        await flushMicrotasks();
        expect(unhandledRejections).toEqual([]);

        redisPing.mockResolvedValue('PONG');
        await expect(appController.health(createResponse())).resolves.toEqual({
          status: 'ok',
          db: 'ok',
          redis: 'ok',
        });
        expect(redisPing).toHaveBeenCalledTimes(2);
      } finally {
        process.off('unhandledRejection', onUnhandledRejection);
        jest.useRealTimers();
      }
    });
  });
});

function createResponse(): Response {
  return { status: jest.fn().mockReturnThis() } as unknown as Response;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
