import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

export const ACCESS_COOKIE = 'sq_at';
export const REFRESH_COOKIE = 'sq_rt';

// httpOnly — главное здесь: скрипт на странице (свой или заехавший с
// чужой зависимостью) не прочитает токены, а значит XSS не уносит доступ
// к переписке с психологом.
const BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

// Access живёт минутами — столько же, сколько на бэкенде; refresh —
// столько, сколько разрешает JWT_REFRESH_TTL_DAYS.
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

export function setSessionCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
): void {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...BASE, maxAge: ACCESS_MAX_AGE });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, { ...BASE, maxAge: REFRESH_MAX_AGE });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, '', { ...BASE, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { ...BASE, maxAge: 0 });
}

export async function readAccessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}

export async function readRefreshToken(): Promise<string | null> {
  return (await cookies()).get(REFRESH_COOKIE)?.value ?? null;
}
