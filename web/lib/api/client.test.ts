import { apiFetch, ApiError } from './client';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function mock(status: number, payload: unknown) {
  const fn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('apiFetch', () => {
  it('ходит через прокси, а не в бэкенд напрямую', async () => {
    const fetchMock = mock(200, []);

    await apiFetch('consultations');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/proxy/consultations');
  });

  it('на ошибку бросает ApiError с кодом бэкенда', async () => {
    mock(409, { code: 'CONSULTATION_ALREADY_PAID' });

    await expect(apiFetch('consultations/c1/pay', { method: 'POST' })).rejects.toThrow(ApiError);
    await expect(apiFetch('consultations/c1/pay', { method: 'POST' })).rejects.toMatchObject({
      code: 'CONSULTATION_ALREADY_PAID',
      status: 409,
    });
  });

  it('на 401 даёт понять, что сессия кончилась, а не «что-то пошло не так»', async () => {
    mock(401, { code: 'UNAUTHORIZED' });

    await expect(apiFetch('consultations')).rejects.toMatchObject({ status: 401 });
  });

  it('переживает пустое тело у 204', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error('пустое тело');
      },
    }) as unknown as typeof fetch;

    await expect(apiFetch('notifications/read', { method: 'POST' })).resolves.toBeNull();
  });
});
