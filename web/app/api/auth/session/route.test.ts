/** @jest-environment node */
const cookieStore = { value: null as string | null };
jest.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (cookieStore.value ? { value: cookieStore.value } : undefined) }),
}));

// eslint-disable-next-line import/first
import { GET } from './route';

function token(payload: Record<string, unknown>): string {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part(payload)}.signature`;
}

describe('GET /api/auth/session', () => {
  it('без cookie отвечает, что пользователя нет', async () => {
    cookieStore.value = null;

    await expect((await GET()).json()).resolves.toEqual({ user: null });
  });

  it('достаёт пользователя из токена, не ходя в бэкенд', async () => {
    // Эндпоинта «кто я» у бэкенда нет, а лишний сетевой вызов на каждый
    // рендер кабинета не нужен: всё, что требуется интерфейсу, уже в
    // токене, который мы сами и положили в cookie.
    cookieStore.value = token({ sub: 'u1', isGuest: false });

    await expect((await GET()).json()).resolves.toEqual({
      user: { id: 'u1', isGuest: false, isAdmin: false },
    });
  });

  it('различает гостя', async () => {
    cookieStore.value = token({ sub: 'g1', isGuest: true });

    const { user } = (await (await GET()).json()) as { user: { isGuest: boolean } };
    expect(user.isGuest).toBe(true);
  });

  it('на испорченном токене отвечает «нет пользователя», а не падает', async () => {
    cookieStore.value = 'не.токен.вовсе';

    await expect((await GET()).json()).resolves.toEqual({ user: null });
  });
});
