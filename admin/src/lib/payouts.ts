import { apiFetch } from './api';

export interface AdminPayout {
  id: string;
  expertId: string;
  amountTiyn: number;
  maskedPan: string;
  holderName: string;
  monthTotalTiyn: number;
  createdAt: string;
}

export function listPayouts(params: { status?: string; take?: number; skip?: number }): Promise<{ items: AdminPayout[] }> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.take !== undefined) qs.set('take', String(params.take));
  if (params.skip !== undefined) qs.set('skip', String(params.skip));
  return apiFetch(`/admin/payouts?${qs}`);
}

export function approvePayout(id: string): Promise<void> {
  return apiFetch(`/admin/payouts/${id}/approve`, { method: 'POST' });
}

export function rejectPayout(id: string, reason: string): Promise<void> {
  return apiFetch(`/admin/payouts/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
}
