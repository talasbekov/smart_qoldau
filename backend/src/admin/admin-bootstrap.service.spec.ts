import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const EMAIL = 'root@smartqoldau.kz';
const PASSWORD = 'super-secret-pass-1234';

function buildService(
  count: number,
  env: Record<string, string | undefined>,
  createImpl?: (args: { data: Record<string, unknown> }) => Promise<unknown>,
) {
  const created = {
    id: 'admin-bootstrap-1',
    email: EMAIL,
    roles: ['SUPERADMIN'],
  };
  const prisma = {
    adminUser: {
      count: jest.fn().mockResolvedValue(count),
      create: jest
        .fn()
        .mockImplementation(
          createImpl ??
            (({ data }) => Promise.resolve({ ...created, ...data })),
        ),
    },
  };
  const audit = { log: jest.fn() };
  const config = { get: jest.fn((key: string) => env[key]) };
  const service = new AdminBootstrapService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
    audit as unknown as AuditService,
  );
  return { service, prisma, audit };
}

describe('AdminBootstrapService.seedIfEmpty', () => {
  it('таблица admin_users пуста и env заданы -> создаёт суперадмина с bcrypt-хешем и пишет audit staff.created', async () => {
    const { service, prisma, audit } = buildService(0, {
      ADMIN_BOOTSTRAP_EMAIL: EMAIL,
      ADMIN_BOOTSTRAP_PASSWORD: PASSWORD,
    });

    await expect(service.seedIfEmpty()).resolves.toBe('created');

    expect(prisma.adminUser.create).toHaveBeenCalledTimes(1);
    const createArg = prisma.adminUser.create.mock.calls[0][0];
    expect(createArg.data.email).toBe(EMAIL);
    expect(createArg.data.roles).toEqual(['SUPERADMIN']);
    // Пароль хранится только хешем, не исходной строкой.
    expect(createArg.data.passwordHash).not.toBe(PASSWORD);
    await expect(
      bcrypt.compare(PASSWORD, createArg.data.passwordHash),
    ).resolves.toBe(true);

    expect(audit.log).toHaveBeenCalledTimes(1);
    const auditArg = audit.log.mock.calls[0][0];
    expect(auditArg).toEqual(
      expect.objectContaining({
        actorType: 'admin',
        entity: 'staff',
        transition: 'staff.created',
      }),
    );
    // Пароль/хеш не должны попадать в audit-payload.
    expect(JSON.stringify(auditArg)).not.toContain(PASSWORD);
  });

  it('таблица admin_users не пуста -> create не вызывается, seedIfEmpty возвращает skipped', async () => {
    const { service, prisma, audit } = buildService(1, {
      ADMIN_BOOTSTRAP_EMAIL: EMAIL,
      ADMIN_BOOTSTRAP_PASSWORD: PASSWORD,
    });

    await expect(service.seedIfEmpty()).resolves.toBe('skipped');
    expect(prisma.adminUser.create).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('env ADMIN_BOOTSTRAP_EMAIL/PASSWORD не заданы -> create не вызывается, seedIfEmpty возвращает skipped', async () => {
    const { service, prisma, audit } = buildService(0, {});

    await expect(service.seedIfEmpty()).resolves.toBe('skipped');
    expect(prisma.adminUser.create).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('гонка параллельного старта: count()=0 у обоих, create() второго ловит P2002 -> skipped, без audit и без падения onModuleInit', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      { code: 'P2002', clientVersion: '6.19.3' },
    );
    const { service, prisma, audit } = buildService(
      0,
      { ADMIN_BOOTSTRAP_EMAIL: EMAIL, ADMIN_BOOTSTRAP_PASSWORD: PASSWORD },
      () => Promise.reject(p2002),
    );

    await expect(service.seedIfEmpty()).resolves.toBe('skipped');
    expect(prisma.adminUser.create).toHaveBeenCalledTimes(1);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('create() падает с не-P2002 ошибкой -> проброс исключения (не проглатывается как skipped)', async () => {
    const other = new Prisma.PrismaClientKnownRequestError('Timeout', {
      code: 'P2024',
      clientVersion: '6.19.3',
    });
    const { service } = buildService(
      0,
      { ADMIN_BOOTSTRAP_EMAIL: EMAIL, ADMIN_BOOTSTRAP_PASSWORD: PASSWORD },
      () => Promise.reject(other),
    );

    await expect(service.seedIfEmpty()).rejects.toBe(other);
  });
});
