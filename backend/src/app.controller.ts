import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

type HealthDependencyStatus = 'ok' | 'fail';
type HealthDependency = 'db' | 'redis';
type HealthCheckInFlight = {
  operation: Promise<HealthDependencyStatus>;
  result: Promise<HealthDependencyStatus>;
};

const HEALTH_CHECK_TIMEOUT_MS = 1_000;

@Controller()
export class AppController {
  private dbCheckInFlight?: HealthCheckInFlight;
  private redisCheckInFlight?: HealthCheckInFlight;

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

  private checkWithTimeout(
    dependency: HealthDependency,
    check: () => Promise<unknown>,
  ): Promise<HealthDependencyStatus> {
    return this.getOrStartCheck(dependency, check).result;
  }

  private getOrStartCheck(
    dependency: HealthDependency,
    check: () => Promise<unknown>,
  ): HealthCheckInFlight {
    const inFlight =
      dependency === 'db' ? this.dbCheckInFlight : this.redisCheckInFlight;
    if (inFlight) return inFlight;

    const operation = Promise.resolve()
      .then(check)
      .then<HealthDependencyStatus, HealthDependencyStatus>(
        () => 'ok',
        () => 'fail',
      );
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutResult = new Promise<HealthDependencyStatus>((resolve) => {
      timeout = setTimeout(() => resolve('fail'), HEALTH_CHECK_TIMEOUT_MS);
    });
    const result = Promise.race([operation, timeoutResult]);
    const startedCheck = { operation, result };
    if (dependency === 'db') this.dbCheckInFlight = startedCheck;
    else this.redisCheckInFlight = startedCheck;

    void operation.then(() => {
      if (timeout) clearTimeout(timeout);
      if (dependency === 'db' && this.dbCheckInFlight === startedCheck) {
        this.dbCheckInFlight = undefined;
      }
      if (dependency === 'redis' && this.redisCheckInFlight === startedCheck) {
        this.redisCheckInFlight = undefined;
      }
    });

    return startedCheck;
  }
}
