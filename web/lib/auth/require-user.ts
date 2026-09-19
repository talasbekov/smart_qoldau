import { redirect } from 'next/navigation';
import { accessExpiresAt } from './token-expiry';
import { readAccessToken, readRefreshToken } from './cookies';
import { decodeToken, type SessionUser } from './decode-token';

// Защита страниц кабинета. Не проверка прав — их проверяет NestJS на
// каждом запросе, — а вежливость: не показывать каркас кабинета тому,
// кто всё равно не получит ни одной строки данных.
export async function requireUser(locale: string): Promise<SessionUser> {
  const token = await readAccessToken();
  const expiresAt = accessExpiresAt(token);
  const user = token && (expiresAt === null || expiresAt > Date.now()) ? decodeToken(token) : null;

  if (!user) {
    // Middleware normally preserves the destination. This is the safe SSR
    // fallback when a layout renders without that middleware path.
    if (await readRefreshToken()) redirect(`/${locale}/renew-session`);
    redirect(`/${locale}/login`);
  }

  return user;
}
