import { login, totpVerify } from './auth';

describe('login', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('возвращает kind session при обычном входе', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: 'a', refreshToken: 'r', admin: { id: '1', email: 'x', roles: [] } }),
    }) as unknown as typeof fetch;

    const result = await login('x@y.kz', 'pass');
    expect(result.kind).toBe('session');
  });

  it('возвращает kind totp при totpRequired', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ totpRequired: true, challengeToken: 'ct' }),
    }) as unknown as typeof fetch;

    const result = await login('x@y.kz', 'pass');
    expect(result).toEqual({ kind: 'totp', challengeToken: 'ct' });
  });
});

describe('totpVerify', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('возвращает сессию', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: 'a', refreshToken: 'r', admin: { id: '1', email: 'x', roles: [] } }),
    }) as unknown as typeof fetch;

    const session = await totpVerify('ct', '123456');
    expect(session.accessToken).toBe('a');
  });
});
