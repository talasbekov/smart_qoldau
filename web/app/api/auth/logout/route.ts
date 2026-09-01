import { NextResponse } from 'next/server';
import { guardOrigin } from '@/lib/auth/proxy';
import { clearSessionCookies } from '@/lib/auth/cookies';

export async function POST(request: Request): Promise<NextResponse> {
  const blocked = guardOrigin(request);
  if (blocked) return blocked;

  // Cookie снимаются в любом случае, даже если бэкенд недоступен: выход
  // должен работать всегда, иначе человек не может уйти с чужого
  // компьютера.
  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
