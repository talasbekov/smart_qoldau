import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new AuditService(prisma);
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: 'u1' } });
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
});
