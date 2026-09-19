/** @jest-environment node */
// Импорты поднимаются выше объявлений, поэтому фабрика мока не может
// ссылаться на переменную из этого файла — она ещё не создана. Мок
// объявляется внутри фабрики, а достаётся из самого модуля.
jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

const token = { value: null as string | null };
const refresh = { value: null as string | null };
jest.mock('./cookies', () => ({ readAccessToken: async () => token.value, readRefreshToken: async () => refresh.value }));

// eslint-disable-next-line import/first
import { redirect } from 'next/navigation';
// eslint-disable-next-line import/first
import { requireUser } from './require-user';

const mockRedirect = redirect as unknown as jest.Mock;

function jwt(payload: Record<string, unknown>): string {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `header.${part(payload)}.signature`;
}

beforeEach(() => { jest.clearAllMocks(); refresh.value = null; });

describe('requireUser', () => {
  it('без сессии уводит на вход, а не показывает пустой кабинет', async () => {
    token.value = null;

    await expect(requireUser('ru')).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/ru/login');
  });

  it('уводит на вход и при испорченном токене', async () => {
    token.value = 'не.токен.вовсе';

    await expect(requireUser('ru')).rejects.toThrow('NEXT_REDIRECT');
  });

  it('сохраняет локаль при переходе на вход', async () => {
    token.value = null;

    await expect(requireUser('kz')).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/kz/login');
  });

  it('возвращает пользователя, когда сессия есть', async () => {
    token.value = jwt({ sub: 'u1', isGuest: false });

    await expect(requireUser('ru')).resolves.toEqual({ id: 'u1', isGuest: false, isAdmin: false });
  });

  it('гость — тоже пользователь: он может завести заявку', async () => {
    // Гостевой вход существует ровно ради анонимного обращения; выгонять
    // гостя из кабинета значило бы сломать этот путь.
    token.value = jwt({ sub: 'g1', isGuest: true });

    await expect(requireUser('ru')).resolves.toMatchObject({ isGuest: true });
  });
});
it('redirects expired SSR access to renewal when a refresh cookie exists', async () => {
  token.value = jwt({ sub: 'u1', exp: 1 });
  refresh.value = 'refresh';
  await expect(requireUser('kz')).rejects.toThrow('NEXT_REDIRECT');
  expect(mockRedirect).toHaveBeenCalledWith('/kz/renew-session');
});
it('redirects expired access without refresh to login', async () => {
  token.value = jwt({ sub: 'u1', exp: 1 });
  await expect(requireUser('ru')).rejects.toThrow('NEXT_REDIRECT');
  expect(mockRedirect).toHaveBeenCalledWith('/ru/login');
});
