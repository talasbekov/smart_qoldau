import sitemap from './sitemap';
import { listContent, listExperts, listTopics } from '@/lib/api/public';

jest.mock('@/lib/api/public', () => ({
  listExperts: jest.fn(),
  listTopics: jest.fn(),
  listContent: jest.fn(),
}));

const experts = listExperts as jest.Mock;
const topics = listTopics as jest.Mock;
const content = listContent as jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
  experts.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
  topics.mockResolvedValue([{ slug: 'burnout' }]);
  content.mockResolvedValue([{ id: 'c1' }]);
});

describe('sitemap', () => {
  it('includes experts beyond one API page without exceeding the API limit of 100', async () => {
    const rows = Array.from({ length: 105 }, (_, index) => ({ id: `expert-${index}` }));
    experts.mockImplementation(async ({ take, skip = 0 }) =>
      take > 100 ? [] : rows.slice(skip, skip + take),
    );

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain('https://smartqoldau.kz/ru/experts/expert-104');
    expect(urls).toContain('https://smartqoldau.kz/kz/experts/expert-104');
  });

  it('fetches each content locale with valid pagination and keeps locale-specific URLs', async () => {
    const rows = Array.from({ length: 105 }, (_, index) => ({ id: `ru-${index}` }));
    content.mockImplementation(async ({ take, skip = 0, locale }) => {
      if (take > 100) return [];
      return (locale === 'kk' ? [{ id: 'kk-only' }] : rows).slice(skip, skip + take);
    });

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain('https://smartqoldau.kz/ru/materials/ru-104');
    expect(urls).toContain('https://smartqoldau.kz/kz/materials/kk-only');
    expect(urls).not.toContain('https://smartqoldau.kz/kz/materials/ru-104');
  });

  it('retains other dynamic sections when one API fails', async () => {
    experts.mockRejectedValueOnce(new Error('offline'));
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain('https://smartqoldau.kz/ru/materials/c1');
    expect(urls).toContain('https://smartqoldau.kz/kz/catalog?topic=burnout');
  });

  it('includes the public about page in both locales', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain('https://smartqoldau.kz/ru/about');
    expect(urls).toContain('https://smartqoldau.kz/kz/about');
  });
  it('содержит статические страницы на обеих локалях', async () => {
    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).toContain('https://smartqoldau.kz/ru');
    expect(urls).toContain('https://smartqoldau.kz/kz');
    expect(urls).toContain('https://smartqoldau.kz/ru/premium');
    expect(urls).toContain('https://smartqoldau.kz/kz/support');
  });

  it('включает каталог: без него у поисковика нет входа в товар', async () => {
    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).toContain('https://smartqoldau.kz/ru/catalog');
  });

  it('включает каждого специалиста в обеих локалях', async () => {
    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).toContain('https://smartqoldau.kz/ru/experts/e1');
    expect(urls).toContain('https://smartqoldau.kz/kz/experts/e1');
    expect(urls).toContain('https://smartqoldau.kz/ru/experts/e2');
  });

  it('просит у бэкенда страницу специалистов, а не всех разом', async () => {
    await sitemap();

    expect(experts).toHaveBeenCalledWith(expect.objectContaining({ take: expect.any(Number) }));
  });

  it('переживает недоступный бэкенд и отдаёт хотя бы статические страницы', async () => {
    experts.mockRejectedValueOnce(new Error('нет сети'));

    const urls = (await sitemap()).map((e) => e.url);

    // Карта сайта, падающая из-за бэкенда, валит сборку целиком.
    expect(urls).toContain('https://smartqoldau.kz/ru');
    expect(urls.some((u) => u.includes('/experts/'))).toBe(false);
  });

  it('включает материалы: без них платные страницы не найдутся в поиске', async () => {
    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).toContain('https://smartqoldau.kz/ru/materials');
    expect(urls).toContain('https://smartqoldau.kz/ru/materials/c1');
  });

  it('не выдаёт дублей: один адрес — одна запись', async () => {
    const urls = (await sitemap()).map((e) => e.url);

    expect(new Set(urls).size).toBe(urls.length);
  });
});
