// Сессия живёт в cookie, а cookie браузер приложит к любому запросу на
// наш адрес — включая тот, что инициировал чужой сайт. Совпадение Origin
// отсекает это дёшево и без состояния. SameSite=Lax на самих cookie
// закрывает то же с другой стороны; вместе они переживают промах в одном.
import { resolveSiteUrl } from './site-url';

const SITE_URL = resolveSiteUrl(process.env);

export class CsrfError extends Error {
  constructor() {
    super('CSRF: запрос пришёл с чужого происхождения');
    this.name = 'CsrfError';
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  // Строгое равенство, а не startsWith и не includes: и то и другое
  // пропускает `http://localhost:3000.evil.example`.
  if (origin !== SITE_URL) {
    throw new CsrfError();
  }
}
