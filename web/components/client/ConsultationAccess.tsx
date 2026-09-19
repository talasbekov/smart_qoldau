import Link from 'next/link';
import type { Consultation } from './ConsultationList';
import LiveConsultation from './LiveConsultation';
import Chat from './Chat';
import ReviewPanel from './ReviewPanel';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

export default function ConsultationAccess({
  consultation,
  locale,
}: {
  consultation: Consultation;
  locale: string;
}) {
  const copy = locale === 'kz' ? kz.checkout : ru.checkout;
  const consultationCopy =
    locale === 'kz' ? kz.consultations : ru.consultations;
  const paymentHref = `/${locale}/consultations/${consultation.id}/payment`;
  const payable =
    consultation.status === 'ACTIVE' || consultation.status === 'SCHEDULED';
  const needsPayment =
    payable &&
    (consultation.paymentStatus === 'UNPAID' ||
      consultation.paymentStatus === 'FAILED');

  if (needsPayment) {
    return (
      <div className="flex flex-col gap-6">
        <section className="rounded-[20px] border border-border bg-white p-6">
          <h2 className="text-lg font-extrabold text-ink">
            {copy.accessPaymentTitle}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-body">
            {copy.accessPaymentBody}
          </p>
          <Link
            href={paymentHref}
            className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {copy.payConsultation}
          </Link>
        </section>

        {consultation.status === 'ACTIVE' && consultation.format === 'chat' ? (
          <section className="rounded-[20px] border border-border bg-white p-4">
            <h2 className="mb-3 font-extrabold text-ink">
              {copy.historyTitle}
            </h2>
            <Chat consultationId={consultation.id} readOnly locale={locale} />
          </section>
        ) : null}
      </div>
    );
  }

  if (consultation.status === 'ACTIVE') {
    if (consultation.paymentStatus !== 'HELD') {
      return (
        <section
          role="status"
          className="rounded-[20px] border border-border bg-white p-6"
        >
          <h2 className="font-extrabold text-ink">
            {copy.accessUnavailableTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-body">
            {copy.accessHoldRequired}
          </p>
        </section>
      );
    }

    return <LiveConsultation consultationId={consultation.id} format={consultation.format as 'chat' | 'audio' | 'video'} locale={locale} />;
  }

  if (consultation.status === 'SCHEDULED') {
    return (
      <section className="rounded-[20px] border border-border bg-white p-6">
        <div role="status">
          <h2 className="font-extrabold text-ink">
            {consultation.paymentStatus === 'HELD'
              ? copy.scheduledHeldTitle
              : copy.accessUnavailableTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-body">
            {consultation.paymentStatus === 'HELD'
              ? copy.scheduledHeldBody
              : copy.accessHoldRequired}
          </p>
        </div>
        <Link
          href={`/${locale}/consultations/${consultation.id}/reschedule`}
          className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {consultationCopy.reschedule}
        </Link>
      </section>
    );
  }

  // История завершённой консультации остаётся читаемой; сервер отдельно
  // запрещает новые сообщения для неактивной консультации.
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[20px] border border-border bg-white p-4">
        <Chat consultationId={consultation.id} readOnly locale={locale} />
      </div>
      {consultation.status === 'COMPLETED' &&
      consultation.outcome === 'COMPLETED' ? (
        <ReviewPanel consultation={consultation} locale={locale} />
      ) : null}
    </div>
  );
}
