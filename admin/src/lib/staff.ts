import { apiFetch } from './api';
import type { AdminRole } from './types';

export interface StaffCard {
  id: string;
  email: string;
  roles: AdminRole[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function listStaff(params: { take?: number; skip?: number }): Promise<{ items: StaffCard[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.take !== undefined) qs.set('take', String(params.take));
  if (params.skip !== undefined) qs.set('skip', String(params.skip));
  return apiFetch(`/admin/staff?${qs}`);
}

export function createStaff(dto: { email: string; password: string; roles: AdminRole[] }): Promise<StaffCard> {
  return apiFetch('/admin/staff', { method: 'POST', body: JSON.stringify(dto) });
}

export function updateStaff(id: string, dto: { roles?: AdminRole[]; isActive?: boolean }): Promise<StaffCard> {
  return apiFetch(`/admin/staff/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
}
