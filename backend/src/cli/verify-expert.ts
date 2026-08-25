/**
 * Ручная подстановка VERIFIED для тестового эксперта (E7, задача 17, шаг 2).
 *
 * Верификация — операция админки (E8, вне объёма E7): очередь модерации,
 * решение сотрудника по документам/фото/about. Настоящего пути «стать
 * VERIFIED» без ручной проверки у бэкенда нет и не должно быть. Этот скрипт
 * — обход ИСКЛЮЧИТЕЛЬНО для integration_test `app_expert`, который не может
 * (и не должен) гонять реальную очередь модерации: находит эксперта по
 * телефону пользователя и напрямую пишет `verificationStatus = VERIFIED`.
 *
 *   npm run expert:verify -- --phone=+77011234567
 */
import { PrismaClient } from '@prisma/client';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found?.slice(prefix.length);
}

export async function verifyExpert(
  prisma: PrismaClient,
  phone: string,
): Promise<{ id: string }> {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    throw new Error(`Пользователь с телефоном ${phone} не найден`);
  }

  const expert = await prisma.expert.findUnique({ where: { userId: user.id } });
  if (!expert) {
    throw new Error(`У пользователя ${phone} нет анкеты эксперта`);
  }

  const updated = await prisma.expert.update({
    where: { id: expert.id },
    data: { verificationStatus: 'VERIFIED' },
  });
  return { id: updated.id };
}

async function main(): Promise<void> {
  const phone = argValue('phone');
  if (!phone) {
    console.error('Использование: npm run expert:verify -- --phone=<телефон>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const result = await verifyExpert(prisma, phone);
    console.log(`Эксперт ${phone} переведён в VERIFIED (${result.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск только как скрипт: импорт из тестов не должен ничего выполнять.
if (require.main === module) {
  void main();
}
