const DEFAULT_URL = 'http://localhost:3000';

// Публичный адрес приложения. Нужен на сервере — для проверки Origin и
// для канонических ссылок, — поэтому обычная переменная времени
// выполнения, а не NEXT_PUBLIC, вшитая в бандл: один образ работает и на
// стенде, и в бою.
export function resolveSiteUrl(env: Record<string, string | undefined>): string {
  const url = env.SITE_URL ?? env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_URL;

  // Origin в заголовке приходит без завершающего слэша, а сравнение
  // строгое: со слэшем в переменной вход отвечал бы 403 всегда.
  return url.replace(/\/+$/, '');
}
