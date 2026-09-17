import { apiFetch } from './api';
import { tokenStore } from './tokenStore';

describe('apiFetch', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('добавляет Authorization из tokenStore', async () => {
    tokenStore.set({ accessToken: 'tok', refreshToken: 'r', admin: { id: '1', email: 'a', roles: [] } });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }) as unknown as typeof fetch;

    await apiFetch('/admin/staff');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/staff'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    );
  });

  it('возвращает undefined на 204 и не пытается читать JSON', async () => {
    const response = new Response(null, { status: 204 });
    const jsonSpy = vi.spyOn(response, 'json');
    globalThis.fetch = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

    await expect(apiFetch<void>('/admin/tickets/1/resolve', { method: 'POST' })).resolves.toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('возвращает JSON успешного 200-ответа', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    await expect(apiFetch<{ ok: boolean }>('/admin/staff')).resolves.toEqual({ ok: true });
  });

  it('бросает ApiError с кодом бэкенда на ошибке', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'ADMIN_FORBIDDEN', message: 'нет прав' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    await expect(apiFetch('/admin/staff')).rejects.toMatchObject({ code: 'ADMIN_FORBIDDEN', status: 403 });
  });

  it('не скрывает ошибку разбора malformed JSON успешного ответа', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('{not-json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    await expect(apiFetch('/admin/staff')).rejects.toBeInstanceOf(SyntaxError);
  });

  it('на 401 один раз обновляет токен через refresh и повторяет запрос', async () => {
    tokenStore.set({ accessToken: 'old', refreshToken: 'r', admin: { id: '1', email: 'a', roles: [] } });
    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      call += 1;
      if (String(url).includes('/admin/auth/refresh')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ accessToken: 'new', refreshToken: 'r2', admin: { id: '1', email: 'a', roles: [] } }),
        });
      }
      if (call === 1) return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: { code: 'UNAUTHORIZED', message: '' } }) });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
    }) as unknown as typeof fetch;

    const result = await apiFetch<{ ok: boolean }>('/admin/staff');

    expect(result.ok).toBe(true);
    expect(tokenStore.get()?.accessToken).toBe('new');
  });
});
