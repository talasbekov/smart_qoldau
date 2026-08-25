import { apiFetch } from './api';

export interface FlaggedReview {
  id: string;
  expertId: string;
  rating: number;
  publicText: string | null;
  privateText: string | null;
  complaint: string | null;
  createdAt: string;
}

export function getFlaggedReviews(): Promise<FlaggedReview[]> {
  return apiFetch('/admin/reviews/flagged');
}

export function resolveReview(id: string, dto: { action: 'hide' | 'restore'; comment?: string }): Promise<void> {
  return apiFetch(`/admin/reviews/${id}/resolve`, { method: 'POST', body: JSON.stringify(dto) });
}
