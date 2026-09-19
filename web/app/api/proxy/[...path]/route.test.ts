/** @jest-environment node */
const cookie = { value: null as string | null };
jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (cookie.value ? { value: cookie.value } : undefined),
  }),
}));

// eslint-disable-next-line import/first
import { DELETE, GET, POST } from './route';

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

function tokenFor(userId: string): string {
  return `x.${Buffer.from(JSON.stringify({ sub: userId })).toString('base64url')}.x`;
}

function req(
  path: string,
  method = 'GET',
  origin = 'http://localhost:3000',
  supportOwner?: string,
) {
  return new Request(`http://localhost:3000/api/proxy/${path}`, {
    method,
    headers: {
      origin,
      'content-type': 'application/json',
      ...(supportOwner ? { 'x-support-owner': supportOwner } : {}),
    },
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

  it('отвергает обратный слэш, который URL нормализует в разделитель пути', async () => {
    cookie.value = 'access-value';
    const fetchMock = upstream();
    const response = await GET(req('experts'), {
      params: Promise.resolve({ path: ['experts', '\\..\\admin', 'experts'] }),
    });
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('не нормализует повторно закодированный dot-сегмент за разрешённый префикс', async () => {
    cookie.value = 'access-value';
    const fetchMock = upstream();
    await GET(req('experts/%252e%252e/admin/experts'), {
      params: Promise.resolve({ path: ['experts', '%2e%2e', 'admin', 'experts'] }),
    });
    const upstreamUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(upstreamUrl.pathname).toMatch(/\/experts\/%252e%252e\/admin\/experts$/);
  });

  it('сохраняет query и fragment символы внутри сегмента', async () => {
    cookie.value = 'access-value';
    const fetchMock = upstream();
    await GET(req('experts/name%3Ftake%3D50%23fragment'), {
      params: Promise.resolve({ path: ['experts', 'name?take=50#fragment'] }),
    });
    const upstreamUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(upstreamUrl.pathname).toMatch(/\/experts\/name%3Ftake%3D50%23fragment$/);
    expect(upstreamUrl.search).toBe('');
    expect(upstreamUrl.hash).toBe('');
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

  it('пропускает только пользовательский tickets API с cookie-авторством', async () => {
    cookie.value = tokenFor('user-1');
    const fetchMock = upstream(201, { id: 'ticket-1' });

    const response = await POST(
      req('tickets', 'POST', 'http://localhost:3000', 'user-1'),
      ctx('tickets'),
    );

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/tickets'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${cookie.value}`,
        }),
      }),
    );
  });

  it('пропускает ответ автора, но не открывает служебные или будущие ticket-действия', async () => {
    cookie.value = tokenFor('user-1');
    const fetchMock = upstream(204, null);

    const reply = await POST(
      req(
        'tickets/00000000-0000-0000-0000-000000000001/reply',
        'POST',
        'http://localhost:3000',
        'user-1',
      ),
      ctx('tickets/00000000-0000-0000-0000-000000000001/reply'),
    );
    const resolve = await POST(
      req('tickets/00000000-0000-0000-0000-000000000001/resolve', 'POST'),
      ctx('tickets/00000000-0000-0000-0000-000000000001/resolve'),
    );
    const remove = await DELETE(
      req('tickets/00000000-0000-0000-0000-000000000001', 'DELETE'),
      ctx('tickets/00000000-0000-0000-0000-000000000001'),
    );

    expect(reply.status).toBe(204);
    expect(resolve.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('не отправляет ticket mutation от устаревшей вкладки другого владельца', async () => {
    cookie.value = tokenFor('user-b');
    const fetchMock = upstream(201, { id: 'must-not-exist' });

    const response = await POST(
      req('tickets', 'POST', 'http://localhost:3000', 'user-a'),
      ctx('tickets'),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: 'SUPPORT_SESSION_CHANGED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('не принимает ticket mutation без ожидаемого владельца формы', async () => {
    cookie.value = tokenFor('user-b');
    const fetchMock = upstream(201, { id: 'must-not-exist' });

    const response = await POST(req('tickets', 'POST'), ctx('tickets'));

    expect(response.status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('пропускает создание брони, но только через origin guard и пользовательскую сессию', async () => {
    cookie.value = 'access-value';
    const fetchMock = upstream(201, { consultationId: 'c1' });

    const response = await POST(req('bookings', 'POST'), ctx('bookings'));

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/bookings'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-value',
        }),
      }),
    );
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
