/** @jest-environment node */
const cookie = { value: null as string | null };
jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (cookie.value ? { value: cookie.value } : undefined),
  }),
}));

// eslint-disable-next-line import/first
import { GET, POST } from './route';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function upstream(status = 200, payload: unknown = { ok: true }) {
  const fn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function req(path: string, method = 'GET', origin = 'http://localhost:3000') {
  return new Request(`http://localhost:3000/api/proxy/${path}`, {
    method,
    headers: { origin, 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : '{}',
  });
}

const ctx = (path: string) => ({
  params: Promise.resolve({ path: path.split('/') }),
});

describe('прокси кабинета', () => {
  it('подставляет токен из cookie: браузер его не видит и подставить не может', async () => {
    cookie.value = 'access-value';
    const fetchMock = upstream();

    await GET(req('consultations'), ctx('consultations'));

    const init = fetchMock.mock.calls[0][1] as {
      headers: Record<string, string>;
    };
    expect(init.headers.Authorization).toBe('Bearer access-value');
  });

  it('без сессии отвечает 401 и не ходит в бэкенд', async () => {
    cookie.value = null;
    const fetchMock = upstream();

    const response = await GET(req('consultations'), ctx('consultations'));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('НЕ пропускает админские маршруты: прокси не открытый ретранслятор', async () => {
    cookie.value = 'access-value';
    const fetchMock = upstream();

    const response = await GET(
      req('admin/experts/flagged'),
      ctx('admin/experts/flagged'),
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('не пропускает выход за пределы разрешённого через ..', async () => {
    cookie.value = 'access-value';
    const fetchMock = upstream();

    const response = await GET(
      req('consultations/../admin/experts/flagged'),
      ctx('consultations/../admin/experts/flagged'),
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('не обманывается префиксом: «consultationsX» — не «consultations»', async () => {
    cookie.value = 'access-value';
    const fetchMock = upstream();

    const response = await GET(req('consultationsX'), ctx('consultationsX'));

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('пропускает офферы: без них эксперт не может принять заявку', async () => {
    cookie.value = 'access-value';
    const fetchMock = upstream();

    const response = await POST(
      req('offers/o1/accept', 'POST'),
      ctx('offers/o1/accept'),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('пропускает отзывы: без них эксперт не может ответить', async () => {
    cookie.value = 'access-value';
    const fetchMock = upstream();

    const response = await POST(
      req('reviews/r1/reply', 'POST'),
      ctx('reviews/r1/reply'),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('пропускает сохранённые способы оплаты для checkout', async () => {
    cookie.value = 'access-value';
    const fetchMock = upstream(200, []);

    const response = await GET(req('payment-methods'), ctx('payment-methods'));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/payment-methods'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('не открывает изменение способов оплаты: checkout использует их только для чтения', async () => {
    cookie.value = 'access-value';
    const fetchMock = upstream(201, { id: 'pm-new' });

    const response = await POST(
      req('payment-methods', 'POST'),
      ctx('payment-methods'),
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('изменяющий запрос с чужого происхождения отвергается', async () => {
    cookie.value = 'access-value';
    const fetchMock = upstream();

    const response = await POST(
      req('requests', 'POST', 'https://evil.example'),
      ctx('requests'),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('передаёт статус и тело бэкенда как есть', async () => {
    cookie.value = 'access-value';
    upstream(409, { code: 'CONSULTATION_ALREADY_PAID' });

    const response = await POST(
      req('consultations/c1/pay', 'POST'),
      ctx('consultations/c1/pay'),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: 'CONSULTATION_ALREADY_PAID',
    });
  });

  it('доносит строку запроса до бэкенда', async () => {
    cookie.value = 'access-value';
    const fetchMock = upstream();

    const request = new Request(
      'http://localhost:3000/api/proxy/notifications?take=20',
      {
        headers: { origin: 'http://localhost:3000' },
      },
    );
    await GET(request, ctx('notifications'));

    expect(fetchMock.mock.calls[0][0]).toContain('?take=20');
  });
});
