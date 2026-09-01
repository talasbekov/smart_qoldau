import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['next-intl', 'use-intl', '@formatjs/fast-memoize'],
  // Для контейнера: Next кладёт в .next/standalone минимальный сервер со
  // своими зависимостями, и в рантайм-образ не нужно тащить node_modules
  // целиком (разница — сотни мегабайт и вся dev-часть дерева).
  output: 'standalone',
};

export default withNextIntl(nextConfig);
