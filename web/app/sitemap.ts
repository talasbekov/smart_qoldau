import type { MetadataRoute } from 'next';
import { routing } from '@/lib/i18n/routing';
import { listContent, listExperts, listTopics } from '@/lib/api/public';

import { resolveSiteUrl } from '@/lib/auth/site-url';

const SITE_URL = resolveSiteUrl({ ...process.env, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://smartqoldau.kz' });
const PAGES = ['', '/catalog', '/materials', '/about', '/become-expert', '/premium', '/terms', '/privacy', '/support'];

// Верхняя граница на выгрузку: карта сайта не должна превращаться в
// выгрузку всей базы при росте каталога. Когда специалистов станет
// больше, здесь появится разбиение на несколько файлов через индекс.
const EXPERTS_IN_SITEMAP = 500;

// The API accepts at most 100 records per request. Keep the existing total
// limits, but walk valid pages instead of silently receiving validation errors.
async function collectPages<T>(
  limit: number,
  load: (take: number, skip: number) => Promise<T[]>,
): Promise<T[]> {
  const result: T[] = [];
  while (result.length < limit) {
    const take = Math.min(100, limit - result.length);
    try {
      const page = await load(take, result.length);
      result.push(...page.slice(0, take));
      if (page.length < take) break;
    } catch {
      break;
    }
  }
  return result;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const staticEntries = routing.locales.flatMap((locale) =>
    PAGES.map((page) => ({ url: `${SITE_URL}/${locale}${page}`, lastModified })),
  );

  const [experts, topics, ...contentByLocale] = await Promise.all([
    collectPages(EXPERTS_IN_SITEMAP, (take, skip) => listExperts({ take, skip })),
    listTopics().catch(() => []),
    ...routing.locales.map((locale) =>
      collectPages(200, (take, skip) =>
        listContent({ take, skip, locale: locale === 'kz' ? 'kk' : locale }),
      ),
    ),
  ]);
  const dynamicEntries = routing.locales.flatMap((locale, index) => [
    ...experts.map((expert) => ({
      url: `${SITE_URL}/${locale}/experts/${expert.id}`,
      lastModified,
    })),
    ...topics.map((topic) => ({
      url: `${SITE_URL}/${locale}/catalog?topic=${encodeURIComponent(topic.slug)}`,
      lastModified,
    })),
    ...contentByLocale[index].map((item) => ({
      url: `${SITE_URL}/${locale}/materials/${item.id}`,
      lastModified,
    })),
  ]);

  return [...new Map([...staticEntries, ...dynamicEntries].map((entry) => [entry.url, entry])).values()];
}
