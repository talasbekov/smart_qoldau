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
  // Resolve the cabinet from canonical expert data; UserDto has no role.
  const expert = await callBackend('/experts/me', { method: 'GET', token: tokens.accessToken }).catch(() => null);
  const response = NextResponse.json({ user: tokens.user, cabinet: expert?.ok ? 'expert' : 'client' });
  setSessionCookies(response, tokens);
  return response;
}
