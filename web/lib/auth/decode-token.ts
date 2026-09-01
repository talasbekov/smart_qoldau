export type SessionUser = { id: string; isGuest: boolean; isAdmin: boolean };

// Подпись НЕ проверяется намеренно: результат используется только для
// отрисовки и выбора маршрута. Любое решение о доступе к данным
// принимает NestJS, когда тот же токен приходит к нему в Authorization.
export function decodeToken(token: string): SessionUser | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as {
      sub?: string;
      isGuest?: boolean;
      isAdmin?: boolean;
    };
    if (!payload.sub) return null;

    return {
      id: payload.sub,
      isGuest: Boolean(payload.isGuest),
      isAdmin: Boolean(payload.isAdmin),
    };
  } catch {
    return null;
  }
}
