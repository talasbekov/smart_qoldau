import { apiFetch } from './api';

export interface TotpSetupResponse {
  secret: string;
  otpauthUrl: string;
  recoveryCodes: string[];
}

export function totpSetup(): Promise<TotpSetupResponse> {
  return apiFetch<TotpSetupResponse>('/admin/auth/totp/setup', { method: 'POST' });
}

export function totpConfirm(code: string): Promise<void> {
  return apiFetch<void>('/admin/auth/totp/confirm', { method: 'POST', body: JSON.stringify({ code }) });
}
