import type { components } from './api/generated';

export type TicketCategory =
  components['schemas']['CreateTicketDto']['category'];
export type TicketCreated = components['schemas']['TicketCreatedDto'];
export type TicketSummary = components['schemas']['TicketSummaryDto'];
export type TicketDetail = components['schemas']['TicketDetailDto'];
export type TicketMessage = components['schemas']['TicketMessageDto'];

export type SupportAuthor = 'client' | 'expert';

const CLIENT_CATEGORIES = [
  'CONSULTATIONS',
  'PAYMENT',
  'TECHNICAL',
  'ACCOUNT_DATA',
  'SECURITY',
  'OTHER',
] as const satisfies readonly TicketCategory[];

const EXPERT_CATEGORIES = [
  'CONSULTATIONS',
  'PAYMENT',
  'PAYOUTS',
  'TECHNICAL',
  'VERIFICATION',
  'SECURITY',
  'CLIENT_QUESTION',
] as const satisfies readonly TicketCategory[];

export function categoriesForAuthor(
  author: SupportAuthor,
): readonly TicketCategory[] {
  return author === 'expert' ? EXPERT_CATEGORIES : CLIENT_CATEGORIES;
}

export interface PendingTicketCreate {
  category: TicketCategory;
  subject: string;
  baselineIds: string[];
}

export function reconcileCreatedTicket(
  tickets: TicketSummary[],
  pending: PendingTicketCreate,
): TicketSummary | null {
  const baseline = new Set(pending.baselineIds);
  const matches = tickets.filter(
    (ticket) =>
      !baseline.has(ticket.id) &&
      ticket.category === pending.category &&
      ticket.subject === pending.subject,
  );
  return matches.length === 1 ? matches[0] : null;
}

export interface PendingTicketReply {
  body: string;
  baselineIds: string[];
}

export function reconcileReply(
  messages: TicketMessage[],
  pending: PendingTicketReply,
): TicketMessage | null {
  const baseline = new Set(pending.baselineIds);
  const matches = messages.filter(
    (message) =>
      !baseline.has(message.id) &&
      message.authorKind === 'user' &&
      message.body === pending.body,
  );
  return matches.length === 1 ? matches[0] : null;
}
