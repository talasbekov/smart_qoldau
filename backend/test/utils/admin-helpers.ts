import { INestApplication } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';

const BCRYPT_ROUNDS = 10;

export interface AdminAuth {
  id: string;
  token: string;
  authHeader: [string, string];
}

let seq = 0;

// Создаёт сотрудника напрямую через Prisma (bcrypt-хеш пароля) и логинит его
// через POST /v1/admin/auth/login. email по умолчанию уникален (метка +
// timestamp + счётчик), чтобы не конфликтовать со строками admin_users,
// оставшимися в тестовой БД от прошлых прогонов (см. progress.md, задача 1).
export async function adminUser(
  app: INestApplication,
  roles: AdminRole[],
  email?: string,
): Promise<AdminAuth> {
  const prisma = app.get(PrismaService);
  const resolvedEmail =
    email ?? `admin-helper-e2e-${Date.now()}-${seq++}@smartqoldau.kz`;
  const password = 'test-admin-password-1234';
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const created = await prisma.adminUser.create({
    data: { email: resolvedEmail, passwordHash, roles },
  });

  const res = await request(app.getHttpServer())
    .post('/v1/admin/auth/login')
    .send({ email: resolvedEmail, password })
    .expect(200);

  const token = res.body.accessToken as string;
  return {
    id: created.id,
    token,
    authHeader: ['Authorization', `Bearer ${token}`],
  };
}

const FIXTURE_OPERATOR_EMAIL =
  'e2e-fixture-verification-operator@smartqoldau.kz';
const FIXTURE_OPERATOR_PASSWORD = 'e2e-fixture-operator-password-0123456789';

// Общий фикстур-сотрудник с ролью VERIFICATION_OPERATOR для e2e-хелперов,
// которые сами не владеют жизненным циклом спека (test/utils/expert-helpers.ts
// и другие спеки, для которых верификация — лишь шаг подготовки данных, а не
// предмет теста; сами тесты роли/доступа живут в admin-verification.e2e-spec.ts).
// В отличие от adminUser() строка НЕ одноразовая: upsert по фиксированному
// email, без накопления мусора в admin_users между прогонами.
export async function verificationOperatorAuth(
  app: INestApplication,
): Promise<AdminAuth> {
  const prisma = app.get(PrismaService);
  const passwordHash = await bcrypt.hash(
    FIXTURE_OPERATOR_PASSWORD,
    BCRYPT_ROUNDS,
  );

  const admin = await prisma.adminUser.upsert({
    where: { email: FIXTURE_OPERATOR_EMAIL },
    create: {
      email: FIXTURE_OPERATOR_EMAIL,
      passwordHash,
      roles: ['VERIFICATION_OPERATOR'],
    },
    update: { passwordHash, roles: ['VERIFICATION_OPERATOR'], isActive: true },
  });

  const res = await request(app.getHttpServer())
    .post('/v1/admin/auth/login')
    .send({
      email: FIXTURE_OPERATOR_EMAIL,
      password: FIXTURE_OPERATOR_PASSWORD,
    })
    .expect(200);

  const token = res.body.accessToken as string;
  return {
    id: admin.id,
    token,
    authHeader: ['Authorization', `Bearer ${token}`],
  };
}
