import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditService } from './audit.service';

// Заглушка Redis для дедупликации access-логов: повторяет контракт
// `set(key, value, 'EX', ttl, 'NX')` — вернуть 'OK' на первый захват ключа
// и null, пока ключ жив.
class FakeRedis {
  readonly keys = new Set<string>();
  set(key: string, _v: string, _ex: string, _ttl: number, flag: string) {
    if (flag === 'NX' && this.keys.has(key)) return Promise.resolve(null);
    this.keys.add(key);
    return Promise.resolve('OK');
  }
}

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaService;
  let redis: FakeRedis;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  beforeEach(async () => {
    redis = new FakeRedis();
    service = new AuditService(prisma, redis as unknown as RedisService);
    await prisma.auditLog.deleteMany({ where: { entityId: 'u1' } });
    await prisma.auditLog.deleteMany({ where: { entityId: 'c1' } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('пишет запись в audit_log', async () => {
    await service.log({
      actorType: 'system',
      entity: 'user',
      entityId: 'u1',
      transition: 'user.registered',
    });
    const rows = await prisma.auditLog.findMany({ where: { entityId: 'u1' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].transition).toBe('user.registered');
  });

  it('logAccess пишет первое обращение', async () => {
    await service.logAccess({
      actorType: 'user',
      actorId: 'u1',
      entity: 'consultation',
      entityId: 'c1',
      transition: 'consultation.metadata_read',
    });
    const rows = await prisma.auditLog.findMany({ where: { entityId: 'c1' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].actorId).toBe('u1');
  });

  it('logAccess схлопывает повторные обращения того же актора в окне дедупликации', async () => {
    const entry = {
      actorType: 'user' as const,
      actorId: 'u1',
      entity: 'consultation',
      entityId: 'c1',
      transition: 'consultation.metadata_read',
    };
    await service.logAccess(entry);
    await service.logAccess(entry);
    await service.logAccess(entry);

    const rows = await prisma.auditLog.findMany({ where: { entityId: 'c1' } });
    expect(rows).toHaveLength(1);
  });

  it('logAccess не схлопывает обращения РАЗНЫХ акторов и разных типов доступа', async () => {
    await service.logAccess({
      actorType: 'user',
      actorId: 'u1',
      entity: 'consultation',
      entityId: 'c1',
      transition: 'consultation.metadata_read',
    });
    await service.logAccess({
      actorType: 'expert',
      actorId: 'u2',
      entity: 'consultation',
      entityId: 'c1',
      transition: 'consultation.metadata_read',
    });
    await service.logAccess({
      actorType: 'user',
      actorId: 'u1',
      entity: 'consultation',
      entityId: 'c1',
      transition: 'consultation.messages_read',
    });

    const rows = await prisma.auditLog.findMany({ where: { entityId: 'c1' } });
    expect(rows).toHaveLength(3);
  });

  it('сбой Redis не отменяет запись access-лога (fail-open)', async () => {
    const brokenRedis = {
      set: () => Promise.reject(new Error('redis down')),
    } as unknown as RedisService;
    const withBrokenRedis = new AuditService(prisma, brokenRedis);

    await withBrokenRedis.logAccess({
      actorType: 'user',
      actorId: 'u1',
      entity: 'consultation',
      entityId: 'c1',
      transition: 'consultation.metadata_read',
    });

    const rows = await prisma.auditLog.findMany({ where: { entityId: 'c1' } });
    expect(rows).toHaveLength(1);
  });
});
