import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

type HealthDependencyStatus = 'ok' | 'fail';
type HealthDependency = 'db' | 'redis';

const HEALTH_CHECK_TIMEOUT_MS = 1_000;

@Controller()
export class AppController {
  private dbCheckInFlight?: Promise<HealthDependencyStatus>;
  private redisCheckInFlight?: Promise<HealthDependencyStatus>;

  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async health(@Res({ passthrough: true }) response: Response) {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    if (db === 'fail' || redis === 'fail') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'unhealthy', db, redis };
    }

    return { status: 'ok', db, redis };
  }

  private checkDb(): Promise<HealthDependencyStatus> {
    return this.checkWithTimeout('db', () => this.prisma.$queryRaw`SELECT 1`);
  }

  private checkRedis(): Promise<HealthDependencyStatus> {
    return this.checkWithTimeout('redis', () => this.redis.ping());
  }

  private async checkWithTimeout(
    dependency: HealthDependency,
    check: () => Promise<unknown>,
  ): Promise<HealthDependencyStatus> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutResult = new Promise<HealthDependencyStatus>((resolve) => {
      timeout = setTimeout(() => resolve('fail'), HEALTH_CHECK_TIMEOUT_MS);
    });
    const checkResult = this.getOrStartCheck(dependency, check);

    try {
      return await Promise.race([checkResult, timeoutResult]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private getOrStartCheck(
    dependency: HealthDependency,
    check: () => Promise<unknown>,
  ): Promise<HealthDependencyStatus> {
    const inFlight =
      dependency === 'db' ? this.dbCheckInFlight : this.redisCheckInFlight;
    if (inFlight) return inFlight;

    const operation = Promise.resolve()
      .then(check)
      .then<HealthDependencyStatus, HealthDependencyStatus>(
        () => 'ok',
        () => 'fail',
      );
    if (dependency === 'db') this.dbCheckInFlight = operation;
    else this.redisCheckInFlight = operation;

    void operation.finally(() => {
      if (dependency === 'db' && this.dbCheckInFlight === operation) {
        this.dbCheckInFlight = undefined;
      }
      if (dependency === 'redis' && this.redisCheckInFlight === operation) {
        this.redisCheckInFlight = undefined;
      }
    });

    return operation;
  }
}
