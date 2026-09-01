/** @jest-environment node */
import { POST } from './route';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth/cookies';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function request(body: unknown, origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/auth/verify-code', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function upstream(status: number, payload: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }) as unknown as typeof fetch;
}

const TOKENS = {
  accessToken: 'access-value',
  refreshToken: 'refresh-value',
  user: { id: 'u1', role: 'CLIENT' },
};

describe('POST /api/auth/verify-code', () => {
  it('кладёт токены в httpOnly-cookie', async () => {
    upstream(200, TOKENS);

    const response = await POST(request({ phone: '+77010000000', code: '123456' }));
    const cookies = response.headers.getSetCookie().join(';');

    expect(cookies).toContain(`${ACCESS_COOKIE}=access-value`);
    expect(cookies).toContain(`${REFRESH_COOKIE}=refresh-value`);
    expect(cookies.toLowerCase()).toContain('httponly');
  });

  it('НЕ отдаёт токены в теле: иначе весь смысл BFF теряется', async () => {
    upstream(200, TOKENS);

    const response = await POST(request({ phone: '+77010000000', code: '123456' }));
    const body = JSON.stringify(await response.json());

    expect(body).not.toContain('access-value');
    expect(body).not.toContain('refresh-value');
  });

  it('отдаёт наружу только пользователя', async () => {
    upstream(200, TOKENS);

    const response = await POST(request({ phone: '+77010000000', code: '123456' }));

    await expect(response.json()).resolves.toEqual({ user: { id: 'u1', role: 'CLIENT' } });
  });

  it('передаёт код ошибки бэкенда как есть, не выдумывая свой', async () => {
    upstream(400, { code: 'SMS_CODE_INVALID' });

    const response = await POST(request({ phone: '+77010000000', code: '000000' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ code: 'SMS_CODE_INVALID' });
  });

  it('на ошибке не ставит cookie', async () => {
    upstream(400, { code: 'SMS_CODE_INVALID' });

    const response = await POST(request({ phone: '+77010000000', code: '000000' }));

    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it('отвергает запрос с чужого происхождения и не ходит в бэкенд', async () => {
    upstream(200, TOKENS);

    const response = await POST(request({ phone: '+77010000000', code: '123456' }, 'https://evil.example'));

    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
