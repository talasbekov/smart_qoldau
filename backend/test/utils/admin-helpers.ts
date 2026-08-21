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
