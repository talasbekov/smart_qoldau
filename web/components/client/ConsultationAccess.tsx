import Link from 'next/link';
import type { Consultation } from './ConsultationList';
import Session from './Session';
import Chat from './Chat';
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

    return consultation.format === 'chat' ? (
      <div className="rounded-[20px] border border-border bg-white p-4">
        <Chat consultationId={consultation.id} locale={locale} />
      </div>
    ) : (
      <Session
        consultationId={consultation.id}
        format={consultation.format as 'audio' | 'video'}
        locale={locale}
      />
    );
  }

  if (consultation.status === 'SCHEDULED') {
    return (
      <section
        role="status"
        className="rounded-[20px] border border-border bg-white p-6"
      >
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
      </section>
    );
  }

  // История завершённой консультации остаётся читаемой; сервер отдельно
  // запрещает новые сообщения для неактивной консультации.
  return (
    <div className="rounded-[20px] border border-border bg-white p-4">
      <Chat consultationId={consultation.id} readOnly locale={locale} />
    </div>
  );
}
