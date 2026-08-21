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

// Логинит уже существующего (id, email, известный пароль) сотрудника через
// POST /v1/admin/auth/login и собирает AdminAuth. Общая часть adminUser() и
// verificationOperatorAuth() — единственное, чем они отличаются, это как
// строка admin_users создаётся (create разовой vs upsert фикстуры).
async function loginAndBuildAuth(
  app: INestApplication,
  id: string,
  email: string,
  password: string,
): Promise<AdminAuth> {
  const res = await request(app.getHttpServer())
    .post('/v1/admin/auth/login')
    .send({ email, password })
    .expect(200);

  const token = res.body.accessToken as string;
  return { id, token, authHeader: ['Authorization', `Bearer ${token}`] };
}

// Создаёт сотрудника напрямую через Prisma (bcrypt-хеш пароля) и логинит его
// через POST /v1/admin/auth/login. email по умолчанию уникален (метка +
// timestamp + счётчик), чтобы не конфликтовать со строками admin_users,
// оставшимися в тестовой БД от прошлых прогонов (см. progress.md, задача 1).
// Одноразовая строка — вызывающий спек обязан передать явный email со своим
// префиксом и убрать её в собственном cleanup().
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

  return loginAndBuildAuth(app, created.id, resolvedEmail, password);
}

const FIXTURE_OPERATOR_EMAIL =
  'e2e-fixture-verification-operator@smartqoldau.kz';
const FIXTURE_OPERATOR_PASSWORD = 'e2e-fixture-operator-password-0123456789';

// Общий фикстур-сотрудник с ролью VERIFICATION_OPERATOR — ТОЛЬКО для
// test/utils/expert-helpers.ts: это низкоуровневый хелпер без своего
// жизненного цикла спека, от которого транзитивно зависят ~26 e2e-спеков, не
// владеющих его admin-строкой. Для любого спека, у которого ЕСТЬ собственный
// cleanup()/afterAll (т.е. почти везде), используй adminUser() с явным email
// и убирай строку в cleanup() спека — см. admin-verification.e2e-spec.ts.
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

  return loginAndBuildAuth(
    app,
    admin.id,
    FIXTURE_OPERATOR_EMAIL,
    FIXTURE_OPERATOR_PASSWORD,
  );
}
