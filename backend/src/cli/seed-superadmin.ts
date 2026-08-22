/**
 * Восстановление доступа в админку (E11a, задача 6).
 *
 * Единственный путь, когда войти в админку не может НИКТО: пароль забыт,
 * устройство со вторым фактором потеряно, последний суперадмин
 * деактивирован в обход API. Работает напрямую с базой, минуя HTTP.
 *
 *   npm run admin:seed -- --email=boss@smartqoldau.kz --password=...
 *
 * Существующему сотруднику перевыпускается пароль, роль SUPERADMIN
 * возвращается, учётная запись активируется, второй фактор сбрасывается
 * (иначе потерянное устройство продолжало бы запирать вход).
 */
import { PrismaClient, AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 12;

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found?.slice(prefix.length);
}

export async function seedSuperadmin(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<{ id: string; created: boolean }> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const existing = await prisma.adminUser.findUnique({ where: { email } });

  if (!existing) {
    const created = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        roles: [AdminRole.SUPERADMIN],
        isActive: true,
      },
    });
    return { id: created.id, created: true };
  }

  const updated = await prisma.adminUser.update({
    where: { id: existing.id },
    data: {
      passwordHash,
      isActive: true,
      roles: existing.roles.includes(AdminRole.SUPERADMIN)
        ? existing.roles
        : [...existing.roles, AdminRole.SUPERADMIN],
      // Сброс второго фактора — часть восстановления: иначе потерянное
      // устройство продолжает запирать вход даже с новым паролем.
      totpSecret: null,
      totpEnabledAt: null,
    },
  });
  await prisma.adminRecoveryCode.deleteMany({
    where: { adminUserId: updated.id },
  });
  return { id: updated.id, created: false };
}

async function main(): Promise<void> {
  const email = argValue('email');
  const password = argValue('password');

  if (!email || !password) {
    console.error(
      'Использование: npm run admin:seed -- --email=<email> --password=<пароль>',
    );
    process.exit(1);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`,
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const result = await seedSuperadmin(prisma, email, password);
    console.log(
      result.created
        ? `Суперадмин ${email} создан (${result.id})`
        : `Пароль суперадмина ${email} перевыпущен, второй фактор сброшен (${result.id})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск только как скрипт: импорт из тестов не должен ничего выполнять.
if (require.main === module) {
  void main();
}
