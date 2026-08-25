import { apiFetch } from './api';

export interface ModerationItem {
  expertId: string;
  displayName: string;
  photoPendingUrl: string | null;
  aboutPending: string | null;
  submittedAt: string;
}

export function getModerationQueue(params: {
  take?: number;
  skip?: number;
}): Promise<{ items: ModerationItem[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.take !== undefined) qs.set('take', String(params.take));
  if (params.skip !== undefined) qs.set('skip', String(params.skip));
  return apiFetch(`/admin/profile-moderation?${qs}`);
}

export function decidePhoto(expertId: string, dto: { action: 'approve' | 'reject'; comment?: string }): Promise<void> {
  return apiFetch(`/admin/profile-moderation/${expertId}/photo/decision`, { method: 'POST', body: JSON.stringify(dto) });
}

export function decideAbout(expertId: string, dto: { action: 'approve' | 'reject'; comment?: string }): Promise<void> {
  return apiFetch(`/admin/profile-moderation/${expertId}/about/decision`, { method: 'POST', body: JSON.stringify(dto) });
}
