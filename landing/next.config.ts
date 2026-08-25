import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['next-intl', 'use-intl', '@formatjs/fast-memoize'],
};

export default withNextIntl(nextConfig);
