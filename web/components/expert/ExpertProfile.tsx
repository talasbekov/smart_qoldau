import Link from 'next/link';
import type { ExpertPublic, ExpertReviews } from '@/lib/api/public';
import ExpertAvatar from './ExpertAvatar';

const PROFILE_COPY = {
  ru: {
    back: 'Все специалисты',
    role: 'Психолог',
    experienceSuffix: 'опыта',
    rating: 'отзывов',
    about: 'О специалисте',
    languages: 'Языки',
    formats: 'Форматы',
    reviews: 'Отзывы',
    noReviews: 'У специалиста пока нет отзывов',
    score: (rating: number) => `оценка ${rating} из 5`,
    anonymous: 'Анонимный клиент',
    reply: 'Ответ специалиста',
    perConsultation: 'за консультацию',
    booking: 'Записаться на консультацию',
    privacy: 'Конфиденциально: знает только ваш психолог',
    experience: {
      LESS_THAN_YEAR: 'менее года',
      ONE_TO_THREE: '1–3 года',
      THREE_TO_FIVE: '3–5 лет',
      FIVE_TO_TEN: '5–10 лет',
      MORE_THAN_TEN: 'более 10 лет',
    },
    language: { ru: 'Русский', kz: 'Қазақша', en: 'English' },
    format: { chat: 'Чат', audio: 'Аудио', video: 'Видео' },
  },
  kz: {
    back: 'Барлық мамандар',
    role: 'Психолог',
    experienceSuffix: 'тәжірибе',
    rating: 'пікір',
    about: 'Маман туралы',
    languages: 'Тілдер',
    formats: 'Форматтар',
    reviews: 'Пікірлер',
    noReviews: 'Маман туралы пікірлер әзірге жоқ',
    score: (rating: number) => `5-тен ${rating} ұпай`,
    anonymous: 'Аноним клиент',
    reply: 'Маманның жауабы',
    perConsultation: 'кеңес үшін',
    booking: 'Кеңеске жазылу',
    privacy: 'Құпия: тек психологіңіз біледі',
    experience: {
      LESS_THAN_YEAR: 'бір жылдан аз',
      ONE_TO_THREE: '1–3 жыл',
      THREE_TO_FIVE: '3–5 жыл',
      FIVE_TO_TEN: '5–10 жыл',
      MORE_THAN_TEN: '10 жылдан астам',
    },
    language: { ru: 'Орысша', kz: 'Қазақша', en: 'English' },
    format: { chat: 'Чат', audio: 'Аудио', video: 'Видео' },
  },
};

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
  const copy = locale === 'kz' ? PROFILE_COPY.kz : PROFILE_COPY.ru;

  return (
    <>
      <Link
        href={`/${locale}/catalog`}
        className="mb-6 inline-block text-sm font-bold text-primary"
      >
        ← {copy.back}
      </Link>

      {/* Две колонки на широком экране, одна на телефоне: карточка с ценой
          на мобильном должна идти после текста, а не отодвигать его вниз. */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-6 flex items-center gap-4">
            <ExpertAvatar photoUrl={expert.photoUrl} size={80} />
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-ink">
                {expert.displayName}
              </h1>
              <p className="text-sm font-medium text-faint">
                {copy.role} · {expert.city} ·{' '}
                {copy.experience[expert.experience as keyof typeof copy.experience] ??
                  expert.experience}{' '}
                {copy.experienceSuffix}
              </p>
              {expert.ratingCount > 0 && (
                <p className="mt-1 text-sm font-bold text-ink">
                  ⭐ {expert.ratingAvg.toFixed(1)} · {expert.ratingCount}{' '}
                  {copy.rating}
                </p>
              )}
            </div>
          </div>

          {expert.about && (
            <section className="mb-8">
              <h2 className="mb-2 text-lg font-extrabold text-ink">
                {copy.about}
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-body">
                {expert.about}
              </p>
            </section>
          )}

          <dl className="mb-8 flex flex-wrap gap-x-10 gap-y-4">
            <Fact
              title={copy.languages}
              value={expert.languages
                .map(
                  (code) =>
                    copy.language[code as keyof typeof copy.language] ?? code,
                )
                .join(', ')}
            />
            <Fact
              title={copy.formats}
              value={expert.formats
                .map(
                  (format) =>
                    copy.format[format as keyof typeof copy.format] ?? format,
                )
                .join(', ')}
            />
          </dl>

          <section>
            <h2 className="mb-3 text-lg font-extrabold text-ink">
              {copy.reviews}
            </h2>
            {items.length === 0 ? (
              <p className="text-sm text-muted">{copy.noReviews}</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {items.map((review, index) => (
                  <li
                    key={index}
                    className="rounded-2xl border border-border bg-white p-5"
                  >
                    <p className="mb-1 text-sm font-bold text-ink">
                      {'★'.repeat(review.rating)}
                      <span className="sr-only">{copy.score(review.rating)}</span>
                    </p>
                    <p className="mb-2 text-xs text-faint">
                      {new Date(review.createdAt).toLocaleDateString(
                        locale === 'kz' ? 'kk-KZ' : 'ru-KZ',
                      )}{' '}
                      · {copy.anonymous}
                    </p>
                    {review.publicText && (
                      <p className="text-sm leading-relaxed text-body">
                        {review.publicText}
                      </p>
                    )}
                    {review.expertReply && (
                      <p className="mt-3 border-l-2 border-chip pl-3 text-sm text-muted">
                        {copy.reply}: {review.expertReply}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-[20px] border border-border bg-white p-6 lg:sticky lg:top-20">
          <p className="text-2xl font-extrabold text-ink">
            {tenge(expert.priceTiyn)}
          </p>
          <p className="mb-5 text-xs text-faint">{copy.perConsultation}</p>
          <Link
            href={`/${locale}/consultations/book/${expert.id}`}
            className="block rounded-[20px] bg-primary px-5 py-3 text-center text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {copy.booking}
          </Link>
          <p className="mt-3 text-center text-xs text-muted">
            {copy.privacy}
          </p>
        </aside>
      </div>
    </>
  );
}
