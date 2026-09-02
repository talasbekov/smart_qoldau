/** @jest-environment node */
const store = { access: null as string | null, refresh: null as string | null };
jest.mock('@/lib/auth/cookies', () => ({
  readAccessToken: async () => store.access,
  readRefreshToken: async () => store.refresh,
  ACCESS_COOKIE: 'sq_at',
  REFRESH_COOKIE: 'sq_rt',
  setSessionCookies: jest.fn(),
}));

// eslint-disable-next-line import/first
import { GET } from './route';

function jwt(expSecondsFromNow: number): string {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `h.${part({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.s`;
}

describe('GET /api/realtime/token', () => {
  it('без сессии — 401', async () => {
    store.access = null;

    expect((await GET()).status).toBe(401);
  });

  it('отдаёт access-токен для сокета и видео', async () => {
    store.access = jwt(600);

    await expect((await GET()).json()).resolves.toEqual({ token: store.access });
  });

  it('НИКОГДА не отдаёт refresh-токен', async () => {
    store.access = jwt(600);
    store.refresh = 'refresh-value';

    const body = JSON.stringify(await (await GET()).json());

    // Короткий access в браузере — принятый компромисс: окно в минуты.
    // Refresh там означал бы бессрочный доступ к переписке.
    expect(body).not.toContain('refresh-value');
  });

  it('не отдаёт протухший токен: подключение с ним всё равно оборвётся', async () => {
    store.access = jwt(-10);

    expect((await GET()).status).toBe(401);
  });
});
