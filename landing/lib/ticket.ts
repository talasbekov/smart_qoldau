export interface TicketFormInput {
  name: string;
  contact: string;
  message: string;
}

export interface CreateTicketPayload {
  category: 'OTHER';
  subject: string;
  body: string;
  contactEmail?: string;
  contactPhone?: string;
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) return `+7${digits}`;
  return null;
}

export function buildTicketPayload(input: TicketFormInput): CreateTicketPayload {
  const trimmedContact = input.contact.trim();
  const isEmail = trimmedContact.includes('@');
  const phone = isEmail ? null : normalizePhone(trimmedContact);

  return {
    category: 'OTHER',
    subject: 'Обращение с сайта SmartQoldau',
    body: `${input.name.trim()}: ${input.message.trim()}`,
    ...(isEmail ? { contactEmail: trimmedContact } : {}),
    ...(phone ? { contactPhone: phone } : {}),
  };
}
