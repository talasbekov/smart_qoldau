import { NextResponse } from 'next/server';
import { callBackend, guardOrigin } from '@/lib/auth/proxy';
import { readAccessToken, readRefreshToken, setSessionCookies } from '@/lib/auth/cookies';
import { decodeToken } from '@/lib/auth/decode-token';
import { accessExpiresAt, RENEW_BEFORE_MS } from '@/lib/auth/token-expiry';

export async function POST(request: Request): Promise<NextResponse> {
  const blocked = guardOrigin(request);
  if (blocked) return blocked;
  const access = await readAccessToken();
  const expiresAt = accessExpiresAt(access);
  const user = access ? decodeToken(access) : null;
  // Another tab may have renewed while this caller waited for the browser lock.
  if (user && expiresAt && expiresAt > Date.now() + RENEW_BEFORE_MS) {
    return NextResponse.json({ user, expiresAt });
  }
  const refreshToken = await readRefreshToken();
  if (!refreshToken) return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const upstream = await callBackend('/auth/refresh', {
      method: 'POST', body: JSON.stringify({ refreshToken }),
    });
    // Never clear cookies on an old/rejected request. Login/logout own that state.
    if (!upstream.ok) return NextResponse.json(upstream.payload, { status: upstream.status });
    const tokens = upstream.payload as { accessToken: string; refreshToken: string };
    const nextUser = decodeToken(tokens.accessToken);
    const nextExpiry = accessExpiresAt(tokens.accessToken);
    if (!nextUser || !nextExpiry || nextExpiry <= Date.now() || !tokens.refreshToken) {
      return NextResponse.json({ code: 'INVALID_SESSION' }, { status: 502 });
    }
    const response = NextResponse.json({ user: nextUser, expiresAt: nextExpiry });
    setSessionCookies(response, tokens);
    return response;
  } catch {
    // Rotation is single-use: a lost response must never cause a blind retry.
    return NextResponse.json({ code: 'SESSION_UNAVAILABLE' }, { status: 503 });
  }
}
