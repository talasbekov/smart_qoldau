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
      dbQuery.mockImplementation(() => new Promise(() => undefined));
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
  });
});

function createResponse(): Response {
  return { status: jest.fn().mockReturnThis() } as unknown as Response;
}
