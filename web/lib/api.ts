import { listExperts } from './api/public';

// Единственный источник правды по публичному API — lib/api/public.ts,
// типы там генерируются из OpenAPI бэкенда. Guest helper живёт отдельно,
// чтобы private SSR API configuration не попадала в его client bundle;
// совместимый реэкспорт сохраняет существующие импорты `@/lib/api`.
export type { ExpertPublic } from './api/public';
export { submitTicket, type SubmitTicketResult } from './api/guest-ticket';

export async function fetchPublicExperts(take: number) {
  return listExperts({ take });
}
