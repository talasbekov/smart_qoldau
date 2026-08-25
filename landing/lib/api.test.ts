import { fetchPublicExperts, submitTicket } from './api';
import type { CreateTicketPayload } from './ticket';

describe('fetchPublicExperts', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('возвращает список экспертов при успешном ответе', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: '1',
          displayName: 'Айгуль С.',
          city: 'Алматы',
          experience: 'THREE_TO_FIVE',
          priceTiyn: 399000,
          languages: ['ru'],
          ratingAvg: 4.9,
          ratingCount: 12,
          photoUrl: null,
        },
      ],
    }) as unknown as typeof fetch;

    const result = await fetchPublicExperts(4);

    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('Айгуль С.');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/experts?take=4'),
      expect.anything(),
    );
  });

  it('возвращает пустой список при сбое сети, не бросает', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;

    await expect(fetchPublicExperts(4)).resolves.toEqual([]);
  });

  it('возвращает пустой список при не-200 ответе', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(fetchPublicExperts(4)).resolves.toEqual([]);
  });
});

describe('submitTicket', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const payload: CreateTicketPayload = {
    category: 'OTHER',
    subject: 'Тест',
    body: 'Тест: тест',
    contactEmail: 'a@b.com',
  };

  it('возвращает ok при 201', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201 }) as unknown as typeof fetch;
    await expect(submitTicket(payload)).resolves.toEqual({ ok: true });
  });

  it('возвращает RATE_LIMITED при 429', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;
    await expect(submitTicket(payload)).resolves.toEqual({ ok: false, error: 'RATE_LIMITED' });
  });

  it('возвращает VALIDATION при 400', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch;
    await expect(submitTicket(payload)).resolves.toEqual({ ok: false, error: 'VALIDATION' });
  });

  it('возвращает NETWORK при сбое сети', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;
    await expect(submitTicket(payload)).resolves.toEqual({ ok: false, error: 'NETWORK' });
  });
});
