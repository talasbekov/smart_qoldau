import { apiFetch } from './api';

export interface FlaggedExpert {
  id: string;
  displayName: string;
  ratingAvg: number;
  ratingCount: number;
}

export function getFlaggedExperts(params: { take?: number; skip?: number }): Promise<FlaggedExpert[]> {
  const qs = new URLSearchParams();
  if (params.take !== undefined) qs.set('take', String(params.take));
  if (params.skip !== undefined) qs.set('skip', String(params.skip));
  return apiFetch(`/admin/experts/flagged?${qs}`);
}
