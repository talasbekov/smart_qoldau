import { isSession, tokenStore } from './tokenStore';
import type { SessionSnapshot } from './tokenStore';
import { withSessionLock } from './sessionLock';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/v1';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const changed = () =>
  new ApiError(
    'ADMIN_SESSION_CHANGED',
    'Сессия изменилась. Повторите действие.',
    401,
  );
function currentFor(expected: SessionSnapshot): SessionSnapshot {
  const current = tokenStore.snapshot();
  if (current.id !== expected.id || !current.session) throw changed();
  return current;
}
const refreshing = new Map<string, Promise<SessionSnapshot>>();

function refresh(expected: SessionSnapshot): Promise<SessionSnapshot> {
  const existing = refreshing.get(expected.id);
  if (existing) return existing;
  const pending = withSessionLock(`refresh:${expected.id}`, async (signal) => {
    const current = currentFor(expected);
    if (current.revision !== expected.revision) return current;
    const response = await fetch(`${API_BASE_URL}/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.session!.refreshToken }),
      signal,
    });
    signal.throwIfAborted();
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        await tokenStore.clear(current, true);
      throw new ApiError(
        'ADMIN_REFRESH_FAILED',
        'Не удалось обновить сессию.',
        response.status,
      );
    }
    const next: unknown = await response.json();
    signal.throwIfAborted();
    if (!isSession(next) || next.admin.id !== current.session!.admin.id) {
      throw new ApiError(
        'ADMIN_INVALID_SESSION',
        'Некорректный ответ обновления сессии.',
        401,
      );
    }
    if (!(await tokenStore.replace(current, next, signal))) throw changed();
    return currentFor(current);
  }).finally(() => {
    if (refreshing.get(expected.id) === pending) refreshing.delete(expected.id);
  });
  refreshing.set(expected.id, pending);
  return pending;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const original = tokenStore.snapshot();
  let attempt = original;
  for (let retry = 0; retry < 2; retry++) {
    if (original.session) attempt = currentFor(attempt);
    const headers = new Headers(init.headers);
    if (!headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json');
    if (attempt.session)
      headers.set('Authorization', `Bearer ${attempt.session.accessToken}`);
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
    if (original.session) currentFor(original);
    if (response.status === 401 && original.session) {
      if (retry === 0) {
        init.signal?.throwIfAborted();
        attempt = await refresh(attempt);
        init.signal?.throwIfAborted();
        continue;
      }
      await tokenStore.clear(attempt, true);
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { code: string; message: string };
      } | null;
      throw new ApiError(
        body?.error?.code ?? 'UNKNOWN',
        body?.error?.message ?? response.statusText,
        response.status,
      );
    }
    const result = response.status === 204 ? undefined : await response.json();
    if (original.session) currentFor(original);
    return result as T;
  }
  throw changed();
}
