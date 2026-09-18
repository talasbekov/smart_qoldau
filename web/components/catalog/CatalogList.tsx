import Link from 'next/link';
import type { ExpertPublic } from '@/lib/api/public';
import type { Selected } from './CatalogFilters';
import ExpertAvatar from '@/components/expert/ExpertAvatar';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

function tenge(priceTiyn: number, locale: string): string {
  return `${new Intl.NumberFormat(locale === 'kz' ? 'kk-KZ' : 'ru-KZ').format(Math.round(priceTiyn / 100))} ₸`;
}

function pageHref(locale: string, query: Selected, page: number): string {
  const search = new URLSearchParams(
    Object.entries(query).filter(([, value]) => Boolean(value)) as [string, string][],
  );
  search.set('page', String(page));
  return `/${locale}/catalog?${search.toString()}`;
}

export default function CatalogList({
  experts,
  page,
  pageSize,
  query,
  locale,
}: {
  experts: ExpertPublic[];
  page: number;
  pageSize: number;
  query: Selected;
  locale: string;
}) {
  const copy = locale === 'kz' ? kz.catalog : ru.catalog;
  const languageLabels: Record<string, string> = {
    ru: copy.languageRussianShort,
    kz: copy.languageKazakhShort,
    en: copy.languageEnglish,
  };
  const formatLabels: Record<string, string> = {
    chat: copy.formatChat,
    audio: copy.formatAudio,
    video: copy.formatVideo,
  };
  if (experts.length === 0) {
    return (
      <p className="py-16 text-center text-muted">{copy.empty}</p>
    );
  }

  // Полная страница — признак того, что дальше может быть ещё. Бэкенд
  // общего числа не отдаёт, а заводить ради счётчика лишний запрос на
  // каждую страницу каталога дороже, чем показать ссылку, которая иногда
  // приведёт на пустую страницу.
  const mayHaveMore = experts.length === pageSize;

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-[18px]">
        {experts.map((expert) => (
          <article key={expert.id} className="rounded-[20px] border border-border bg-white p-[22px]">
            <div className="mb-3.5 flex items-center gap-3">
              <ExpertAvatar photoUrl={expert.photoUrl} size={56} />
              <div className="min-w-0">
                <h2 className="text-[15px] font-extrabold text-ink">
                  <Link href={`/${locale}/experts/${expert.id}`} className="hover:underline">
                    {expert.displayName}
                  </Link>
                </h2>
                <p className="text-xs font-medium text-faint">
                  {copy.experienceText
                    .replace('{experience}', copy.experience[expert.experience] ?? expert.experience)}
                </p>
              </div>
            </div>
            {expert.ratingCount > 0 && (
              <p className="mb-2 text-sm font-bold text-ink">
                ⭐ {expert.ratingAvg.toFixed(1)} · {copy.reviewsCount.replace('{count}', String(expert.ratingCount))}
              </p>
            )}
            <p className="mb-2 text-xs text-muted">
              {expert.languages.map((code) => languageLabels[code] ?? code).join(', ')}
              {' · '}
              {expert.formats.map((code) => formatLabels[code] ?? code).join(', ')}
            </p>
            <p className="text-sm font-extrabold text-ink">{tenge(expert.priceTiyn, locale)}</p>
          </article>
        ))}
      </div>

      {(page > 1 || mayHaveMore) && (
        <nav aria-label={copy.paginationLabel} className="mt-8 flex justify-center gap-4">
          {page > 1 && (
            <Link href={pageHref(locale, query, page - 1)} className="rounded-lg px-3 py-2 font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary">
              ← {copy.previous}
            </Link>
          )}
          {mayHaveMore && (
            <Link href={pageHref(locale, query, page + 1)} className="rounded-lg px-3 py-2 font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary">
              {copy.next} →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
