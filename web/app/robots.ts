import type { MetadataRoute } from 'next';

import { resolveSiteUrl } from '@/lib/auth/site-url';

const SITE_URL = resolveSiteUrl({ ...process.env, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://smartqoldau.kz' });

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
