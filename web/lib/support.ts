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
