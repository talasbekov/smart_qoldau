import { NextResponse } from 'next/server';
import { readAccessToken } from '@/lib/auth/cookies';

type SessionUser = { id: string; isGuest: boolean; isAdmin: boolean };

// Эндпоинта «кто я» у бэкенда нет, и заводить его незачем: всё нужное
// интерфейсу уже лежит в токене, который положили в cookie мы сами.
//
// Подпись здесь НЕ проверяется — и это допустимо ровно потому, что
// ответ используется только для отрисовки (показать имя, выбрать
// раскладку). Любое реальное решение о доступе принимает NestJS, когда
// этот же токен приходит к нему в Authorization. Подделать cookie можно
// только имея доступ к браузеру, и подделка не даст ни одного байта
// чужих данных.
function decode(token: string): SessionUser | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as {
      sub?: string;
      isGuest?: boolean;
      isAdmin?: boolean;
    };
    if (!payload.sub) return null;

    return {
      id: payload.sub,
      isGuest: Boolean(payload.isGuest),
      isAdmin: Boolean(payload.isAdmin),
    };
  } catch {
    return null;
  }
}

export async function GET(): Promise<NextResponse> {
  const token = await readAccessToken();
  const user = token ? decode(token) : null;

  return NextResponse.json({ user });
}
