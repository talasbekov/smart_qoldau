import { API_BASE_URL } from './public';
import { readAccessToken } from '@/lib/auth/cookies';

// Серверные запросы кабинета: страница рендерится на сервере, токен
// берётся из httpOnly-cookie. Клиентские компоненты для того же ходят
// через /api/proxy (lib/api/client.ts) — им cookie недоступны.
export async function authorizedFetch<T>(path: string): Promise<T | null> {
  const token = await readAccessToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      // Данные кабинета персональные: кэшировать их между запросами
      // нельзя ни на секунду.
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
