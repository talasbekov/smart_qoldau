import type { Metadata } from 'next';
import { listExperts, listTopics, type ListExpertsParams } from '@/lib/api/public';
import CatalogFilters, { type Selected } from '@/components/catalog/CatalogFilters';
import CatalogList from '@/components/catalog/CatalogList';

const PAGE_SIZE = 12;
const SORTS = ['price_asc', 'price_desc', 'rating'] as const;

export const metadata: Metadata = {
  title: 'Каталог психологов',
  description:
    'Проверенные психологи: чат, аудио и видео. Выберите специалиста по теме, языку и формату.',
};

function readSort(value: string | undefined): ListExpertsParams['sort'] {
  return SORTS.includes(value as (typeof SORTS)[number])
    ? (value as ListExpertsParams['sort'])
    : undefined;
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const raw = await searchParams;
  const one = (key: string): string | undefined => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const selected: Selected = {
    topic: one('topic'),
    format: one('format'),
    language: one('language'),
    sort: readSort(one('sort')),
  };
  const page = Math.max(1, Number(one('page') ?? 1) || 1);

  const [experts, topics] = await Promise.all([
    listExperts({
      ...selected,
      sort: readSort(selected.sort),
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    listTopics(),
  ]);

  return (
    <main className="mx-auto max-w-[1240px] px-8 pb-16 pt-11">
      <h1 className="mb-1.5 text-[30px] font-extrabold text-ink">Найдите своего специалиста</h1>
      <p className="mb-7 text-[14.5px] font-medium text-muted">
        {experts.length > 0
          ? `${experts.length} специалистов на этой странице`
          : 'Подберите фильтры под свой запрос'}
      </p>

      <CatalogFilters topics={topics} selected={selected} action={`/${locale}/catalog`} />
      <CatalogList
        experts={experts}
        page={page}
        pageSize={PAGE_SIZE}
        query={selected}
        locale={locale}
      />
    </main>
  );
}
