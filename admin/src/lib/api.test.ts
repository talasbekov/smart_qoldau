import { apiFetch } from './api';
import { tokenStore } from './tokenStore';

describe('apiFetch', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('добавляет Authorization из tokenStore', async () => {
    await tokenStore.set({
      accessToken: 'tok',
      refreshToken: 'r',
      admin: { id: '1', email: 'a', roles: [] },
    });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      }) as unknown as typeof fetch;

    await apiFetch('/admin/staff');

    const init = vi.mocked(globalThis.fetch).mock.calls[0][1];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok');
  });

  it('бросает ApiError с кодом бэкенда на ошибке', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: 'ADMIN_FORBIDDEN', message: 'нет прав' },
      }),
    }) as unknown as typeof fetch;

    await expect(apiFetch('/admin/staff')).rejects.toMatchObject({
      code: 'ADMIN_FORBIDDEN',
      status: 403,
    });
  });

  it('на 401 один раз обновляет токен через refresh и повторяет запрос', async () => {
    await tokenStore.set({
      accessToken: 'old',
      refreshToken: 'r',
      admin: { id: '1', email: 'a', roles: [] },
    });
    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      call += 1;
      if (String(url).includes('/admin/auth/refresh')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: 'new',
            refreshToken: 'r2',
            admin: { id: '1', email: 'a', roles: [] },
          }),
        });
      }
      if (call === 1)
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: { code: 'UNAUTHORIZED', message: '' } }),
        });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
    }) as unknown as typeof fetch;

    const result = await apiFetch<{ ok: boolean }>('/admin/staff');

    expect(result.ok).toBe(true);
    expect(tokenStore.get()?.accessToken).toBe('new');
  });
});
