const DEFAULT_URL = 'http://localhost:3000/v1';

// Все обращения к бэкенду идут С СЕРВЕРА: публичные страницы рендерятся
// там, а браузер ходит только в /api/* самого Next (BFF). Поэтому адрес —
// обычная серверная переменная времени выполнения, а не NEXT_PUBLIC,
// вшитая в бандл: сменить бэкенд можно перезапуском, без пересборки.
export function resolveApiBaseUrl(env: Record<string, string | undefined>): string {
  const url = env.API_BASE_URL ?? env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_URL;

  if (url.startsWith('/')) {
    throw new Error(
      `Адрес бэкенда должен быть абсолютным: запрос уходит с сервера, и «${url}» ` +
        'означал бы обращение контейнера к самому себе',
    );
  }

  return url;
}
