import { NextResponse } from 'next/server';
import { readAccessToken } from '@/lib/auth/cookies';
import { decodeToken } from '@/lib/auth/decode-token';

// Эндпоинта «кто я» у бэкенда нет, и заводить его незачем: всё нужное
// интерфейсу лежит в токене, который положили в cookie мы сами.
export async function GET(): Promise<NextResponse> {
  const token = await readAccessToken();
  const user = token ? decodeToken(token) : null;

  return NextResponse.json({ user });
}
