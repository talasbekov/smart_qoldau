import type { CreateTicketPayload } from './ticket';
import { listExperts } from './api/public';

// Единственный источник правды по публичному API — lib/api/public.ts,
// типы там генерируются из OpenAPI бэкенда. Здесь остаётся форма
// поддержки и совместимый реэкспорт, чтобы существующие импорты
// `@/lib/api` не переписывать разом.
import { API_BASE_URL } from './api/public';
export { API_BASE_URL };
export type { ExpertPublic } from './api/public';

export async function fetchPublicExperts(take: number) {
  return listExperts({ take });
}

export type SubmitTicketResult =
  | { ok: true }
  | { ok: false; error: 'RATE_LIMITED' | 'VALIDATION' | 'UNKNOWN' };

export async function submitTicket(
  payload: CreateTicketPayload,
): Promise<SubmitTicketResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) return { ok: true };
    if (response.status === 429) return { ok: false, error: 'RATE_LIMITED' };
    if (response.status === 400) return { ok: false, error: 'VALIDATION' };
    return { ok: false, error: 'UNKNOWN' };
  } catch {
    // POST неидемпотентен: при потере ответа сервер мог уже сохранить
    // обращение. Гостю недоступен GET списка, поэтому это не «ошибка» и
    // автоматический/слепой повтор запрещён.
    return { ok: false, error: 'UNKNOWN' };
  }
}
