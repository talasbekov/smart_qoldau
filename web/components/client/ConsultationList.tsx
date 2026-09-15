import Link from 'next/link';
import type { components } from '@/lib/api/generated';
import ExpertAvatar from '@/components/expert/ExpertAvatar';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

export type Consultation = components['schemas']['ConsultationClientDto'];

const FORMAT_LABELS: Record<string, string> = {
  chat: 'Чат',
  audio: 'Аудио',
  video: 'Видео',
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Запланирована',
  ACTIVE: 'Идёт сейчас',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

function tenge(priceTiyn: number): string {
  return `${new Intl.NumberFormat('ru-KZ').format(Math.round(priceTiyn / 100))} ₸`;
}

function when(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ru-KZ', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Card({ item, locale }: { item: Consultation; locale: string }) {
  const finished = item.status === 'COMPLETED';
  const cancelled = item.status === 'CANCELLED';
  // Оплату предлагаем только там, где она ещё имеет смысл: у отменённой
  // консультации кнопка «оплатить» — прямой путь потерять деньги.
  const needsPayment =
    !finished &&
    !cancelled &&
    (item.paymentStatus === 'UNPAID' || item.paymentStatus === 'FAILED');
  const checkout = locale === 'kz' ? kz.checkout : ru.checkout;
  const payLabel =
    item.paymentStatus === 'FAILED' ? checkout.retryPayment : checkout.pay;

  return (
    <li className="rounded-[20px] border border-border bg-white p-5">
      <div className="mb-3 flex items-center gap-3">
        <ExpertAvatar photoUrl={item.expert.photoUrl} size={48} />
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold text-ink">
            {item.expert.displayName}
          </p>
          <p className="text-xs text-faint">
            {FORMAT_LABELS[item.format] ?? item.format} · {when(item.startedAt)}
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded-full bg-chip px-3 py-1 text-ink">
          {STATUS_LABELS[item.status] ?? item.status}
        </span>
        {item.isEmergency && (
          <span className="rounded-full bg-chip px-3 py-1 text-ink">
            Срочная
          </span>
        )}
        <span className="text-muted">{tenge(item.priceTiyn)}</span>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/${locale}/consultations/${item.id}`}
          className="rounded-xl px-3 py-2 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        >
          Открыть
        </Link>
        {needsPayment && (
          <Link
            href={`/${locale}/consultations/${item.id}/payment`}
            className="rounded-xl px-3 py-2 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {payLabel}
          </Link>
        )}
        {finished && !item.reviewId && (
          <Link
            href={`/${locale}/consultations/${item.id}#review`}
            className="rounded-xl px-3 py-2 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Оценить
          </Link>
        )}
      </div>
    </li>
  );
}

export default function ConsultationList({
  items,
  locale,
}: {
  items: Consultation[];
  locale: string;
}) {
  if (items.length === 0) {
    return (
      <div className="py-12">
        <p className="mb-4 text-body">У вас пока нет консультаций</p>
        <Link
          href={`/${locale}/requests/new`}
          className="inline-block rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Найти специалиста
        </Link>
      </div>
    );
  }

  const upcoming = items.filter(
    (i) => i.status === 'SCHEDULED' || i.status === 'ACTIVE',
  );
  const past = items.filter(
    (i) => i.status === 'COMPLETED' || i.status === 'CANCELLED',
  );

  return (
    <div className="flex flex-col gap-8">
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-extrabold text-ink">Предстоящие</h2>
          <ul className="flex flex-col gap-3">
            {upcoming.map((item) => (
              <Card key={item.id} item={item} locale={locale} />
            ))}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-extrabold text-ink">Прошедшие</h2>
          <ul className="flex flex-col gap-3">
            {past.map((item) => (
              <Card key={item.id} item={item} locale={locale} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
