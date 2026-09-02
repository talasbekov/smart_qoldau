import { redirect } from 'next/navigation';
import { readAccessToken } from './cookies';
import { decodeToken, type SessionUser } from './decode-token';

// Защита страниц кабинета. Не проверка прав — их проверяет NestJS на
// каждом запросе, — а вежливость: не показывать каркас кабинета тому,
// кто всё равно не получит ни одной строки данных.
export async function requireUser(locale: string): Promise<SessionUser> {
  const token = await readAccessToken();
  const user = token ? decodeToken(token) : null;

  if (!user) redirect(`/${locale}/login`);

  return user;
}
