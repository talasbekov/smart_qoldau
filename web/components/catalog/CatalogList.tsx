import Link from 'next/link';
import type { ExpertPublic } from '@/lib/api/public';
import type { Selected } from './CatalogFilters';

const EXPERIENCE_LABELS: Record<string, string> = {
  LESS_THAN_YEAR: 'менее года',
  ONE_TO_THREE: '1–3 года',
  THREE_TO_FIVE: '3–5 лет',
  FIVE_TO_TEN: '5–10 лет',
  MORE_THAN_TEN: 'более 10 лет',
};

const LANGUAGE_LABELS: Record<string, string> = { ru: 'Рус', kz: 'Каз', en: 'Eng' };
const FORMAT_LABELS: Record<string, string> = { chat: 'Чат', audio: 'Аудио', video: 'Видео' };

function tenge(priceTiyn: number): string {
  return `${new Intl.NumberFormat('ru-KZ').format(Math.round(priceTiyn / 100))} ₸`;
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
  if (experts.length === 0) {
    return (
      <p className="py-16 text-center text-muted">По заданным фильтрам специалисты не найдены</p>
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
              <div className="h-14 w-14 shrink-0 rounded-full bg-chip" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-[15px] font-extrabold text-ink">
                  <Link href={`/${locale}/experts/${expert.id}`} className="hover:underline">
                    {expert.displayName}
                  </Link>
                </h2>
                <p className="text-xs font-medium text-faint">
                  Психолог · {EXPERIENCE_LABELS[expert.experience] ?? expert.experience} опыта
                </p>
              </div>
            </div>
            {expert.ratingCount > 0 && (
              <p className="mb-2 text-sm font-bold text-ink">
                ⭐ {expert.ratingAvg.toFixed(1)} · {expert.ratingCount} отзывов
              </p>
            )}
            <p className="mb-2 text-xs text-muted">
              {expert.languages.map((code) => LANGUAGE_LABELS[code] ?? code).join(', ')}
              {' · '}
              {expert.formats.map((code) => FORMAT_LABELS[code] ?? code).join(', ')}
            </p>
            <p className="text-sm font-extrabold text-ink">{tenge(expert.priceTiyn)}</p>
          </article>
        ))}
      </div>

      {(page > 1 || mayHaveMore) && (
        <nav aria-label="Страницы каталога" className="mt-8 flex justify-center gap-4">
          {page > 1 && (
            <Link href={pageHref(locale, query, page - 1)} className="font-bold text-primary">
              ← Назад
            </Link>
          )}
          {mayHaveMore && (
            <Link href={pageHref(locale, query, page + 1)} className="font-bold text-primary">
              Дальше →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
