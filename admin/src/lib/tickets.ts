import { apiFetch } from './api';

export interface TicketSummary {
  id: string;
  category: string;
  subject: string;
  status: string;
  team: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  authorKind: 'user' | 'staff';
  body: string;
  createdAt: string;
}

export interface TicketDetail extends TicketSummary {
  body: string;
  firstReplyAt: string | null;
  resolvedAt: string | null;
  authorType: string;
  contactEmail: string | null;
  contactPhone: string | null;
  messages: TicketMessage[];
}

export function listTickets(params: {
  status?: string;
  team?: string;
  assigned?: 'me' | 'none' | 'any';
  take?: number;
  skip?: number;
}): Promise<{ items: TicketSummary[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.team) qs.set('team', params.team);
  if (params.assigned) qs.set('assigned', params.assigned);
  if (params.take !== undefined) qs.set('take', String(params.take));
  if (params.skip !== undefined) qs.set('skip', String(params.skip));
  return apiFetch(`/admin/tickets?${qs}`);
}

export function getTicket(id: string): Promise<TicketDetail> {
  return apiFetch(`/admin/tickets/${id}`);
}

export function replyTicket(id: string, body: string): Promise<void> {
  return apiFetch(`/admin/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ body }) });
}

export function resolveTicket(id: string): Promise<void> {
  return apiFetch(`/admin/tickets/${id}/resolve`, { method: 'POST' });
}

export function assignTicket(id: string, adminUserId?: string | null): Promise<void> {
  return apiFetch(`/admin/tickets/${id}/assign`, { method: 'POST', body: JSON.stringify({ adminUserId }) });
}
