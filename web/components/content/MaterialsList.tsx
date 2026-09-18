import Link from 'next/link';
import type { ContentItem } from '@/lib/api/public';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

// Один раздел с фильтрами, а не четыре отдельных экрана — решение
// владельца от 2026-09-02 (расхождение №11).
export type Selected = { kind?: string; category?: string };

function minutes(durationSec: number | null | undefined, unit: string): string {
  if (!durationSec) return '';
  return `${Math.round(durationSec / 60)} ${unit}`;
}

function hrefWith(locale: string, selected: Selected, kind: string): string {
  const next = { ...selected };
  // Повторное нажатие снимает фильтр: иначе с клавиатуры выбор не отменить.
  if (next.kind === kind) delete next.kind;
  else next.kind = kind;

  const search = new URLSearchParams(
    Object.entries(next).filter(([, v]) => Boolean(v)) as [string, string][],
  ).toString();
  return search ? `/${locale}/materials?${search}` : `/${locale}/materials`;
}

export default function MaterialsList({
  items,
  selected,
  locale,
}: {
  items: ContentItem[];
  selected: Selected;
  locale: string;
}) {
  const copy = locale === 'kz' ? kz.materials : ru.materials;
  const kinds = [
    { value: 'ARTICLE', label: copy.kindArticle },
    { value: 'MEDITATION', label: copy.kindMeditation },
    { value: 'BREATHING', label: copy.kindBreathing },
    { value: 'MUSIC', label: copy.kindMusic },
  ];
  return (
    <>
      <nav aria-label={copy.kindsLabel} className="mb-7 flex flex-wrap gap-2">
        {kinds.map((kind) => {
          const active = selected.kind === kind.value;
          return (
            <Link
              key={kind.value}
              href={hrefWith(locale, selected, kind.value)}
              aria-current={active ? 'true' : undefined}
              className={
                active
                  ? 'rounded-full bg-primary px-4 py-2 text-sm font-bold text-white'
                  : 'rounded-full bg-chip px-4 py-2 text-sm font-bold text-ink'
              }
            >
              {kind.label}
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <p className="py-12 text-body">{copy.empty}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[18px]">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-[20px] border border-border bg-white p-5"
            >
              <h2 className="mb-1 text-[15px] font-extrabold text-ink">
                <Link href={`/${locale}/materials/${item.id}`} className="hover:underline">
                  {item.title}
                </Link>
              </h2>
              {item.summary && <p className="mb-2 text-sm text-body">{item.summary}</p>}
              <p className="flex flex-wrap items-center gap-2 text-xs text-faint">
                {minutes(item.durationSec, copy.minute)}
                {/* Карточку платного материала показываем всегда: человек
                    должен понимать, что именно за подпиской. */}
                {item.locked && (
                  <span className="rounded-full bg-chip px-2 py-0.5 font-bold text-ink">
                    Premium
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
