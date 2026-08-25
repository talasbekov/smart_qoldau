import type { CreateTicketPayload } from './ticket';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1';

export interface ExpertPublic {
  id: string;
  displayName: string;
  city: string;
  experience: string;
  priceTiyn: number;
  languages: string[];
  ratingAvg: number;
  ratingCount: number;
  photoUrl: string | null;
}

export async function fetchPublicExperts(take: number): Promise<ExpertPublic[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/experts?take=${take}`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return [];
    return (await response.json()) as ExpertPublic[];
  } catch {
    return [];
  }
}

export type SubmitTicketResult = { ok: true } | { ok: false; error: 'RATE_LIMITED' | 'VALIDATION' | 'NETWORK' };

export async function submitTicket(payload: CreateTicketPayload): Promise<SubmitTicketResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) return { ok: true };
    if (response.status === 429) return { ok: false, error: 'RATE_LIMITED' };
    if (response.status === 400) return { ok: false, error: 'VALIDATION' };
    return { ok: false, error: 'NETWORK' };
  } catch {
    return { ok: false, error: 'NETWORK' };
  }
}
