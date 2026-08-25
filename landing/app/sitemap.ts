import type { MetadataRoute } from 'next';
import { routing } from '@/lib/i18n/routing';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://smartqoldau.kz';
const PAGES = ['', '/become-expert', '/premium', '/terms', '/privacy', '/support'];

export default function sitemap(): MetadataRoute.Sitemap {
  return routing.locales.flatMap((locale) =>
    PAGES.map((page) => ({
      url: `${SITE_URL}/${locale}${page}`,
      lastModified: new Date(),
    })),
  );
}
