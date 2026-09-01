import { NextResponse } from 'next/server';
import { callBackend, guardOrigin } from '@/lib/auth/proxy';
import { setSessionCookies } from '@/lib/auth/cookies';

type Tokens = { accessToken: string; refreshToken: string; user: unknown };

export async function POST(request: Request): Promise<NextResponse> {
  const blocked = guardOrigin(request);
  if (blocked) return blocked;

  const upstream = await callBackend('/auth/verify-code', {
    method: 'POST',
    body: await request.text(),
  });

  if (!upstream.ok) {
    return NextResponse.json(upstream.payload, { status: upstream.status });
  }

  // Наружу — только пользователь. Токены остаются на сервере: в этом и
  // состоит вся защита, ради которой заведён BFF.
  const tokens = upstream.payload as Tokens;
  const response = NextResponse.json({ user: tokens.user });
  setSessionCookies(response, tokens);
  return response;
}
