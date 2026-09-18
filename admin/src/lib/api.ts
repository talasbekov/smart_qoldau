import { tokenStore } from './tokenStore';
import type { Session } from './types';

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

async function refresh(): Promise<boolean> {
  const session = tokenStore.get();
  if (!session) return false;
  const response = await fetch(`${API_BASE_URL}/admin/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  if (!response.ok) return false;
  const next = (await response.json()) as Session;
  tokenStore.set({ ...next, admin: session.admin });
  return true;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const session = tokenStore.get();
  const isFormData = init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(init.headers as Record<string, string> | undefined),
    ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (response.status === 401 && !isRetry && session) {
    const refreshed = await refresh();
    if (refreshed) return apiFetch<T>(path, init, true);
    tokenStore.clear();
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

  if (response.status === 204) return undefined as T;
  const body = await response.text();
  if (body.length === 0) return undefined as T;
  return JSON.parse(body) as T;
}
