import Link from 'next/link';
import type { ExpertPublic, ExpertReviews } from '@/lib/api/public';
import ExpertAvatar from './ExpertAvatar';

const EXPERIENCE_LABELS: Record<string, string> = {
  LESS_THAN_YEAR: 'менее года',
  ONE_TO_THREE: '1–3 года',
  THREE_TO_FIVE: '3–5 лет',
  FIVE_TO_TEN: '5–10 лет',
  MORE_THAN_TEN: 'более 10 лет',
};
const LANGUAGE_LABELS: Record<string, string> = { ru: 'Русский', kz: 'Қазақша', en: 'English' };
const FORMAT_LABELS: Record<string, string> = { chat: 'Чат', audio: 'Аудио', video: 'Видео' };

function tenge(priceTiyn: number): string {
  return `${new Intl.NumberFormat('ru-KZ').format(Math.round(priceTiyn / 100))} ₸`;
}

function Fact({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-semibold text-faint">{title}</dt>
      <dd className="text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

export default function ExpertProfile({
  expert,
  reviews,
  locale,
}: {
  expert: ExpertPublic;
  reviews: ExpertReviews | null;
  locale: string;
}) {
  const items = reviews?.items ?? [];

  return (
    <>
      <Link href={`/${locale}/catalog`} className="mb-6 inline-block text-sm font-bold text-primary">
        ← Все специалисты
      </Link>

      {/* Две колонки на широком экране, одна на телефоне: карточка с ценой
          на мобильном должна идти после текста, а не отодвигать его вниз. */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-6 flex items-center gap-4">
            <ExpertAvatar photoUrl={expert.photoUrl} size={80} />
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-ink">{expert.displayName}</h1>
              <p className="text-sm font-medium text-faint">
                Психолог · {expert.city} · {EXPERIENCE_LABELS[expert.experience] ?? expert.experience} опыта
              </p>
              {expert.ratingCount > 0 && (
                <p className="mt-1 text-sm font-bold text-ink">
                  ⭐ {expert.ratingAvg.toFixed(1)} · {expert.ratingCount} отзывов
                </p>
              )}
            </div>
          </div>

          {expert.about && (
            <section className="mb-8">
              <h2 className="mb-2 text-lg font-extrabold text-ink">О специалисте</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-body">{expert.about}</p>
            </section>
          )}

          <dl className="mb-8 flex flex-wrap gap-x-10 gap-y-4">
            <Fact
              title="Языки"
              value={expert.languages.map((c) => LANGUAGE_LABELS[c] ?? c).join(', ')}
            />
            <Fact
              title="Форматы"
              value={expert.formats.map((c) => FORMAT_LABELS[c] ?? c).join(', ')}
            />
          </dl>

          <section>
            <h2 className="mb-3 text-lg font-extrabold text-ink">Отзывы</h2>
            {items.length === 0 ? (
              <p className="text-sm text-muted">У специалиста пока нет отзывов</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {items.map((review, index) => (
                  <li key={index} className="rounded-2xl border border-border bg-white p-5">
                    <p className="mb-1 text-sm font-bold text-ink">
                      {'★'.repeat(review.rating)}
                      <span className="sr-only">{`оценка ${review.rating} из 5`}</span>
                    </p>
                    <p className="mb-2 text-xs text-faint">
                      {new Date(review.createdAt).toLocaleDateString('ru-KZ')} · Анонимный клиент
                    </p>
                    {review.publicText && (
                      <p className="text-sm leading-relaxed text-body">{review.publicText}</p>
                    )}
                    {review.expertReply && (
                      <p className="mt-3 border-l-2 border-chip pl-3 text-sm text-muted">
                        Ответ специалиста: {review.expertReply}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-[20px] border border-border bg-white p-6 lg:sticky lg:top-20">
          <p className="text-2xl font-extrabold text-ink">{tenge(expert.priceTiyn)}</p>
          <p className="mb-5 text-xs text-faint">за консультацию</p>
          <Link
            href={`/${locale}/topics`}
            className="block rounded-[20px] bg-primary px-5 py-3 text-center text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Записаться на консультацию
          </Link>
          <p className="mt-3 text-center text-xs text-muted">
            Конфиденциально: знает только ваш психолог
          </p>
        </aside>
      </div>
    </>
  );
}
