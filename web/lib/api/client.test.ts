import { apiFetch, ApiError } from './client';

const originalFetch = global.fetch;
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, work: () => unknown) => work() } });
});
afterEach(() => {
  global.fetch = originalFetch;
});

function mock(status: number, payload: unknown) {
  const fn = jest.fn(async (path: string) => path === '/api/auth/session'
    ? { ok: true, status: 200, json: async () => ({ user: { id: 'u1' }, expiresAt: Date.now() + 120_000 }) }
    : { ok: status >= 200 && status < 300, status, json: async () => payload });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('apiFetch', () => {
  it('ходит через прокси, а не в бэкенд напрямую', async () => {
    const fetchMock = mock(200, []);

    await apiFetch('consultations');

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(['/api/auth/session', '/api/proxy/consultations']);
  });

  it('на ошибку бросает ApiError с кодом бэкенда', async () => {
    mock(409, { code: 'CONSULTATION_ALREADY_PAID' });

    await expect(
      apiFetch('consultations/c1/pay', { method: 'POST' }),
    ).rejects.toThrow(ApiError);
    await expect(
      apiFetch('consultations/c1/pay', { method: 'POST' }),
    ).rejects.toMatchObject({
      code: 'CONSULTATION_ALREADY_PAID',
      status: 409,
    });
  });

  it('читает код из канонического error envelope бэкенда', async () => {
    mock(409, {
      error: { code: 'REVIEW_EXISTS', message: 'Отзыв уже оставлен' },
    });

    await expect(
      apiFetch('consultations/c1/review', { method: 'POST' }),
    ).rejects.toMatchObject({
      code: 'REVIEW_EXISTS',
      status: 409,
    });
  });

  it('на 401 даёт понять, что сессия кончилась, а не «что-то пошло не так»', async () => {
    mock(401, { code: 'UNAUTHORIZED' });

    await expect(apiFetch('consultations')).rejects.toMatchObject({
      status: 401,
    });
  });

  it('переживает пустое тело у 204', async () => {
    mock(204, null);

    await expect(
      apiFetch('notifications/read', { method: 'POST' }),
    ).resolves.toBeNull();
  });
});
