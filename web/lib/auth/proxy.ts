import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api/public';
import { assertSameOrigin } from './csrf';

export type Upstream = { status: number; ok: boolean; payload: unknown };

// Общая часть всех обработчиков BFF: проверить происхождение, сходить в
// NestJS, вернуть его ответ как есть. Коды ошибок бэкенда наружу не
// переписываются — приложения и веб должны разбирать одни и те же.
export async function callBackend(
  path: string,
  init: { method: string; body?: string; token?: string | null },
): Promise<Upstream> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: init.method,
    headers,
    body: init.body,
    cache: 'no-store',
  });

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, payload };
}

export function guardOrigin(request: Request): NextResponse | null {
  try {
    assertSameOrigin(request);
    return null;
  } catch {
    return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
  }
}
