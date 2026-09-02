import sitemap from './sitemap';
import { listExperts, listTopics } from '@/lib/api/public';

jest.mock('@/lib/api/public', () => ({
  listExperts: jest.fn(),
  listTopics: jest.fn(),
}));

const experts = listExperts as jest.Mock;
const topics = listTopics as jest.Mock;

beforeEach(() => {
  experts.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
  topics.mockResolvedValue([{ slug: 'burnout' }]);
});

describe('sitemap', () => {
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

  it('не выдаёт дублей: один адрес — одна запись', async () => {
    const urls = (await sitemap()).map((e) => e.url);

    expect(new Set(urls).size).toBe(urls.length);
  });
});
