import type { Metadata } from 'next';
import { listContent } from '@/lib/api/public';
import MaterialsList, { type Selected } from '@/components/content/MaterialsList';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: 'Материалы для самопомощи',
  description:
    'Статьи, медитации, дыхательные практики и музыка — бесплатно и по подписке.',
};

export default async function MaterialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const copy = locale === 'kz' ? kz.materials : ru.materials;
  const raw = await searchParams;
  const one = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const selected: Selected = { kind: one('kind'), category: one('category') };
  const items = await listContent({
    ...selected,
    // У анонима нет профиля с локалью — язык берём из адреса страницы.
    locale: locale === 'kz' ? 'kk' : 'ru',
    take: PAGE_SIZE,
  });

  return (
    <main className="mx-auto max-w-[1240px] px-4 pb-16 pt-11 sm:px-8">
      <h1 className="mb-2 text-[30px] font-extrabold text-ink">{copy.title}</h1>
      <p className="mb-7 text-[14.5px] font-medium text-muted">
        {copy.subtitle}
      </p>
      <MaterialsList items={items} selected={selected} locale={locale} />
    </main>
  );
}
