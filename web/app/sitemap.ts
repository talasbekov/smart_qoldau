import type { MetadataRoute } from 'next';
import { routing } from '@/lib/i18n/routing';
import { listContent, listExperts, listTopics } from '@/lib/api/public';

import { resolveSiteUrl } from '@/lib/auth/site-url';

const SITE_URL = resolveSiteUrl({ ...process.env, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://smartqoldau.kz' });
const PAGES = ['', '/catalog', '/materials', '/become-expert', '/premium', '/terms', '/privacy', '/support'];

// Верхняя граница на выгрузку: карта сайта не должна превращаться в
// выгрузку всей базы при росте каталога. Когда специалистов станет
// больше, здесь появится разбиение на несколько файлов через индекс.
const EXPERTS_IN_SITEMAP = 500;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticEntries = routing.locales.flatMap((locale) =>
    PAGES.map((page) => ({ url: `${SITE_URL}/${locale}${page}`, lastModified })),
  );

  // Падение бэкенда не должно валить сборку целиком: без динамической
  // части карта сайта хуже, без карты сайта — хуже намного.
  let dynamicEntries: MetadataRoute.Sitemap = [];
  try {
    const [experts, topics, content] = await Promise.all([
      listExperts({ take: EXPERTS_IN_SITEMAP }),
      listTopics(),
      listContent({ take: 200 }),
    ]);

    dynamicEntries = routing.locales.flatMap((locale) => [
      ...experts.map((expert) => ({
        url: `${SITE_URL}/${locale}/experts/${expert.id}`,
        lastModified,
      })),
      ...topics.map((topic) => ({
        url: `${SITE_URL}/${locale}/catalog?topic=${topic.slug}`,
        lastModified,
      })),
      ...content.map((item) => ({
        url: `${SITE_URL}/${locale}/materials/${item.id}`,
        lastModified,
      })),
    ]);
  } catch {
    dynamicEntries = [];
  }

  return [...staticEntries, ...dynamicEntries];
}
