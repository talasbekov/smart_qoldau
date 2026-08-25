import { API_BASE_URL, ApiError } from './api';
import type { Session } from './types';

export type LoginResult = { kind: 'session'; session: Session } | { kind: 'totp'; challengeToken: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const response = await fetch(`${API_BASE_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? response.statusText, response.status);
  }
  if (body.totpRequired) return { kind: 'totp', challengeToken: body.challengeToken };
  return { kind: 'session', session: body as Session };
}

export async function totpVerify(challengeToken: string, code: string): Promise<Session> {
  const response = await fetch(`${API_BASE_URL}/admin/auth/totp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeToken, code }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? response.statusText, response.status);
  }
  return body as Session;
}
