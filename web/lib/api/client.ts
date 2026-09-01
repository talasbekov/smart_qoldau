export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(`Запрос не выполнен: ${code ?? status}`);
    this.name = 'ApiError';
  }
}

// Клиентские компоненты ходят только сюда: прокси сам подставит токен из
// httpOnly-cookie. Прямой адрес бэкенда браузеру неизвестен и не нужен.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const response = await fetch(`/api/proxy/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const code = (payload as { code?: string } | null)?.code ?? null;
    throw new ApiError(response.status, code);
  }

  return payload as T;
}
