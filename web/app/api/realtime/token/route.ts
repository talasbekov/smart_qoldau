import { NextResponse } from 'next/server';
import { readAccessToken } from '@/lib/auth/cookies';

// socket.io и LiveKit подключаются из браузера напрямую, в обход BFF —
// иначе пришлось бы проксировать поток. Значит токен им нужен на руках.
//
// Отдаём ТОЛЬКО короткоживущий access. Это осознанный компромисс: если
// его украдёт XSS, окно составит минуты. Refresh в браузере означал бы
// бессрочный доступ к переписке с психологом, и его здесь нет никогда.
export async function GET(): Promise<NextResponse> {
  const token = await readAccessToken();
  if (!token) return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });

  // Протухший токен отдавать бессмысленно: шлюз оборвёт подключение, а
  // интерфейс будет думать, что связь есть.
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as {
      exp?: number;
    };
    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      return NextResponse.json({ code: 'TOKEN_EXPIRED' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }

  return NextResponse.json({ token });
}
