import { listExperts, getExpert, listTopics } from './public';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetch(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('listExperts', () => {
  it('складывает фильтры в query и не шлёт пустые', async () => {
    mockFetch(200, []);

    await listExperts({ topic: 'burnout', take: 12, skip: 0, language: undefined });

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('topic=burnout');
    expect(url).toContain('take=12');
    expect(url).toContain('skip=0');
    expect(url).not.toContain('language=');
  });

  it('на ошибку сети отдаёт пустой список, а не роняет страницу', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('нет сети')) as unknown as typeof fetch;

    await expect(listExperts({})).resolves.toEqual([]);
  });

  it('без фильтров не приделывает пустой знак вопроса', async () => {
    mockFetch(200, []);

    await listExperts({});

    expect((global.fetch as jest.Mock).mock.calls[0][0]).not.toContain('?');
  });
});

describe('getExpert', () => {
  it('на 404 отдаёт null, чтобы страница показала «не найдено»', async () => {
    mockFetch(404, {});

    await expect(getExpert('11111111-1111-1111-1111-111111111111')).resolves.toBeNull();
  });

  it('помечает ответ тегом конкретного эксперта для точечной ревалидации', async () => {
    mockFetch(200, { id: 'e1' });

    await getExpert('e1');

    const init = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(init.next.tags).toContain('expert:e1');
  });
});

describe('listTopics', () => {
  it('передаёт локаль справочника в API', async () => {
    mockFetch(200, []);

    await listTopics('kz');

    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(
      '/topics?locale=kz',
    );
  });

  it('на ошибку отдаёт пустой справочник', async () => {
    mockFetch(500, {});

    await expect(listTopics()).resolves.toEqual([]);
  });
});
