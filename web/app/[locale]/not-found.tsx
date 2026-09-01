import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';

// Лежит внутри [locale] намеренно: глобальная страница «не найдено»
// рендерится с корневой раскладкой, которая только пробрасывает children,
// и остаётся без <html lang> — скринридер не знает языка страницы.
// Здесь её оборачивает локальная раскладка со всеми ориентирами.
export default async function NotFound() {
  const t = await getTranslations('notFound');

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start px-8 py-24">
      <h1 className="mb-3 text-3xl font-extrabold text-ink">{t('title')}</h1>
      <p className="mb-8 text-body">{t('text')}</p>
      <Link
        href="/catalog"
        className="rounded-[20px] bg-primary px-5 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {t('toCatalog')}
      </Link>
    </main>
  );
}
