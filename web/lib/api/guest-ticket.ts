import type { CreateTicketPayload } from '../ticket';
import { BROWSER_API_BASE_URL } from './browser-base-url';

export type SubmitTicketResult =
  | { ok: true }
  | { ok: false; error: 'RATE_LIMITED' | 'VALIDATION' | 'UNKNOWN' };

export async function submitTicket(
  payload: CreateTicketPayload,
): Promise<SubmitTicketResult> {
  try {
    const response = await fetch(`${BROWSER_API_BASE_URL}/tickets`, {
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
