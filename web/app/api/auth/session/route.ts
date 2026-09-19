import { NextResponse } from 'next/server';
import { readAccessToken } from '@/lib/auth/cookies';
import { accessExpiresAt } from '@/lib/auth/token-expiry';
import { decodeToken } from '@/lib/auth/decode-token';

// Эндпоинта «кто я» у бэкенда нет, и заводить его незачем: всё нужное
// интерфейсу лежит в токене, который положили в cookie мы сами.
export async function GET(): Promise<NextResponse> {
  const token = await readAccessToken();
  const expiresAt = accessExpiresAt(token);
  const user = token && (expiresAt === null || expiresAt > Date.now()) ? decodeToken(token) : null;

  return NextResponse.json({ user, expiresAt }, { headers: { 'Cache-Control': 'no-store' } });
}
