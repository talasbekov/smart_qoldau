import Link from 'next/link';
import type { components } from '@/lib/api/generated';
import ExpertAvatar from '@/components/expert/ExpertAvatar';
import { formatAlmatyDateTime } from '@/lib/format-almaty';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

export type Consultation = components['schemas']['ConsultationClientDto'];

function tenge(priceTiyn: number, locale: string): string {
  return `${new Intl.NumberFormat(locale === 'kz' ? 'kk-KZ' : 'ru-KZ').format(Math.round(priceTiyn / 100))} ₸`;
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
  const copy = locale === 'kz' ? kz.consultations : ru.consultations;
  const formatLabels: Record<string, string> = {
    chat: copy.formatChat,
    audio: copy.formatAudio,
    video: copy.formatVideo,
  };
  const statusLabels: Record<string, string> = {
    SCHEDULED: copy.statusScheduled,
    ACTIVE: copy.statusActive,
    COMPLETED: copy.statusCompleted,
    CANCELLED: copy.statusCancelled,
  };
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
            {formatLabels[item.format] ?? item.format} ·{' '}
            {formatAlmatyDateTime(item.startedAt, locale)} ·{' '}
            {copy.timezoneShort}
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded-full bg-chip px-3 py-1 text-ink">
          {statusLabels[item.status] ?? item.status}
        </span>
        {item.isEmergency && (
          <span className="rounded-full bg-chip px-3 py-1 text-ink">
            {copy.urgent}
          </span>
        )}
        <span className="text-muted">{tenge(item.priceTiyn, locale)}</span>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/${locale}/consultations/${item.id}`}
          className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {copy.open}
        </Link>
        {needsPayment && (
          <Link
            href={`/${locale}/consultations/${item.id}/payment`}
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {payLabel}
          </Link>
        )}
        {item.status === 'SCHEDULED' && (
          <Link
            href={`/${locale}/consultations/${item.id}/reschedule`}
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {copy.reschedule}
          </Link>
        )}
        {finished && item.outcome === 'COMPLETED' && !item.reviewId && (
          <Link
            href={`/${locale}/consultations/${item.id}#review`}
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {copy.review}
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
  const copy = locale === 'kz' ? kz.consultations : ru.consultations;
  if (items.length === 0) {
    return (
      <div className="py-12">
        <p className="mb-4 text-body">{copy.empty}</p>
        <Link
          href={`/${locale}/requests/new`}
          className="inline-block rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {copy.findExpert}
        </Link>
      </div>
    );
  }

  const upcoming = items
    .filter((i) => i.status === 'SCHEDULED' || i.status === 'ACTIVE')
    .sort(
      (left, right) =>
        new Date(left.startedAt).getTime() -
        new Date(right.startedAt).getTime(),
    );
  const past = items.filter(
    (i) => i.status === 'COMPLETED' || i.status === 'CANCELLED',
  );

  return (
    <div className="flex flex-col gap-8">
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-extrabold text-ink">
            {copy.upcoming}
          </h2>
          <ul className="flex flex-col gap-3">
            {upcoming.map((item) => (
              <Card key={item.id} item={item} locale={locale} />
            ))}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-extrabold text-ink">{copy.past}</h2>
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
