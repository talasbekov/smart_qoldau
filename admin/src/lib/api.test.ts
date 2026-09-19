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
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    await apiFetch('/admin/staff');

    expect(new Headers(vi.mocked(globalThis.fetch).mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer tok');
  });

  it('возвращает undefined на 204 и не пытается читать JSON', async () => {
    const response = new Response(null, { status: 204 });
    const jsonSpy = vi.spyOn(response, 'json');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(response) as unknown as typeof fetch;

    await expect(
      apiFetch<void>('/admin/tickets/1/resolve', { method: 'POST' }),
    ).resolves.toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('возвращает JSON успешного 200-ответа', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    await expect(apiFetch<{ ok: boolean }>('/admin/staff')).resolves.toEqual({
      ok: true,
    });
  });

  it('возвращает undefined на успешный 200 с пустым телом', async () => {
    const response = new Response(null, {
      status: 200,
      headers: { 'Content-Length': '0' },
    });
    const jsonSpy = vi.spyOn(response, 'json');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(response) as unknown as typeof fetch;

    await expect(
      apiFetch<void>('/admin/tickets/1/resolve', { method: 'POST' }),
    ).resolves.toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('бросает ApiError с кодом бэкенда на ошибке', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'ADMIN_FORBIDDEN', message: 'нет прав' },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    ) as unknown as typeof fetch;

    await expect(apiFetch('/admin/staff')).rejects.toMatchObject({
      code: 'ADMIN_FORBIDDEN',
      status: 403,
    });
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
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }) as unknown as typeof fetch;

    const result = await apiFetch<{ ok: boolean }>('/admin/staff');

    expect(result.ok).toBe(true);
    expect(tokenStore.get()?.accessToken).toBe('new');
  });

  it('для FormData сохраняет Authorization и не задаёт JSON Content-Type', async () => {
    await tokenStore.set({
      accessToken: 'tok',
      refreshToken: 'r',
      admin: { id: '1', email: 'a', roles: [] },
    });
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
    const form = new FormData();
    form.append('file', new File(['mp3'], 'calm.mp3', { type: 'audio/mpeg' }));

    await apiFetch('/admin/content/c1/audio', { method: 'POST', body: form });

    const [, request] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(request?.body).toBe(form);
    expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer tok');
    expect(new Headers(request?.headers).has('Content-Type')).toBe(false);
  });

  it('повторяет тот же FormData после refresh с новым Authorization и без ручной boundary', async () => {
    await tokenStore.set({
      accessToken: 'old',
      refreshToken: 'r',
      admin: { id: '1', email: 'a', roles: [] },
    });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'UNAUTHORIZED', message: '' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ accessToken: 'new', refreshToken: 'r2', admin: { id: '1', email: 'a', roles: [] } }),
      })
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ) as unknown as typeof fetch;
    const form = new FormData();
    form.append('file', new File(['mp3'], 'calm.mp3', { type: 'audio/mpeg' }));

    await apiFetch('/admin/content/c1/audio', { method: 'POST', body: form });

    const firstRequest = vi.mocked(globalThis.fetch).mock.calls[0][1];
    const retryRequest = vi.mocked(globalThis.fetch).mock.calls[2][1];
    expect(firstRequest?.body).toBe(form);
    expect(retryRequest?.body).toBe(form);
    expect(new Headers(firstRequest?.headers).get('Authorization')).toBe('Bearer old');
    expect(new Headers(retryRequest?.headers).get('Authorization')).toBe('Bearer new');
    expect(new Headers(retryRequest?.headers).has('Content-Type')).toBe(false);
  });
});
