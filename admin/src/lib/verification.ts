import { apiFetch } from './api';

export interface QueueDocument {
  id: string;
  type: string;
  status: string;
  downloadUrl: string;
}

export interface QueueEntry {
  id: string;
  displayName: string;
  verificationStatus: string;
  documents: QueueDocument[];
}

export function getQueue(): Promise<QueueEntry[]> {
  return apiFetch('/admin/verification/queue');
}

export function decideDocument(documentId: string, decision: { approve: boolean; comment?: string }): Promise<void> {
  return apiFetch(`/admin/verification/documents/${documentId}/decision`, {
    method: 'POST',
    body: JSON.stringify(decision),
  });
}

export function decideExpert(expertId: string, decision: { approve: boolean; comment?: string }): Promise<unknown> {
  return apiFetch(`/admin/verification/${expertId}/decision`, { method: 'POST', body: JSON.stringify(decision) });
}

export function blockExpert(expertId: string, reason: string): Promise<unknown> {
  return apiFetch(`/admin/experts/${expertId}/block`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export function unblockExpert(expertId: string): Promise<unknown> {
  return apiFetch(`/admin/experts/${expertId}/unblock`, { method: 'POST' });
}
