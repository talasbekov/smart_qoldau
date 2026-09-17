const DEFAULT_URL = 'http://localhost:3000/v1';
type ApiTarget = 'server' | 'browser';

// Server rendering и BFF используют private runtime API_BASE_URL, чтобы
// образ не привязывался к контуру. Browser target существует только для
// публичного guest POST и берёт explicit build-time NEXT_PUBLIC value.
export function resolveApiBaseUrl(
  env: Record<string, string | undefined>,
  target: ApiTarget = 'server',
): string {
  const url =
    target === 'browser'
      ? (env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_URL)
      : (env.API_BASE_URL ?? env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_URL);

  if (target === 'server' && url.startsWith('/')) {
    throw new Error(
      `Адрес бэкенда должен быть абсолютным: запрос уходит с сервера, и «${url}» ` +
        'означал бы обращение контейнера к самому себе',
    );
  }

  return url;
}
