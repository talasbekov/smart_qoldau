import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

@Controller()
export class AppController {
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
  async health() {
    const db = await this.checkDb();
    const redis = await this.checkRedis();
    return { status: 'ok', db, redis };
  }

  private async checkDb(): Promise<'ok' | 'fail'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'fail';
    }
  }

  private async checkRedis(): Promise<'ok' | 'fail'> {
    try {
      await this.redis.ping();
      return 'ok';
    } catch {
      return 'fail';
    }
  }
}
