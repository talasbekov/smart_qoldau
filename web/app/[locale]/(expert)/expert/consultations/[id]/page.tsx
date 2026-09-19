import { notFound } from 'next/navigation';
import { authorizedFetch } from '@/lib/api/authorized';
import LiveConsultation from '@/components/client/LiveConsultation';
import Chat from '@/components/client/Chat';
import ExpertSessionActions from '@/components/expert-cabinet/ExpertSessionActions';
import ConsultationStatusRefresh from '@/components/expert-cabinet/ConsultationStatusRefresh';
import type { components } from '@/lib/api/generated';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

type ExpertConsultation = components['schemas']['ConsultationExpertDto'];

export default async function ExpertConsultationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const consultation = await authorizedFetch<ExpertConsultation>(
    `consultations/${id}`,
  );
  if (!consultation) notFound();

  const live = consultation.status === 'ACTIVE';
  const paidLive = live && consultation.paymentStatus === 'HELD';
  const checkoutCopy = locale === 'kz' ? kz.checkout : ru.checkout;
  const expertCopy = locale === 'kz' ? kz.expertSession : ru.expertSession;
  const statusLabels: Record<string, string> = {
    SCHEDULED: expertCopy.statusScheduled,
    ACTIVE: expertCopy.statusActive,
    COMPLETED: expertCopy.statusCompleted,
    CANCELLED: expertCopy.statusCancelled,
  };

  return (
    <>
      {/* Код клиента и здесь: имени эксперт не видит нигде. */}
      <h1 className="mb-1 text-2xl font-extrabold text-ink">
        {expertCopy.consultationTitle.replace(
          '{code}',
          String(consultation.clientCode),
        )}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {statusLabels[consultation.status] ?? consultation.status}
      </p>
      <ConsultationStatusRefresh
        consultationId={id}
        initialStatus={consultation.status}
        initialPaymentStatus={consultation.paymentStatus}
        initialFormat={consultation.format}
        locale={locale}
      />

      {paidLive ? (
        // Тот же компонент, что у клиента: разговор устроен одинаково с
        // обеих сторон, и копия кода разъехалась бы с оригиналом.
        <LiveConsultation
          consultationId={id}
          format={consultation.format as 'chat' | 'audio' | 'video'}
          locale={locale}
          senderRole="expert"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {live && !paidLive ? (
            <section
              role="status"
              className="rounded-[20px] border border-border bg-white p-6"
            >
              <h2 className="font-extrabold text-ink">
                {checkoutCopy.accessUnavailableTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-body">
                {checkoutCopy.accessHoldRequired}
              </p>
            </section>
          ) : null}
          <div className="rounded-[20px] border border-border bg-white p-4">
            <Chat
              consultationId={id}
              readOnly={!paidLive}
              locale={locale}
              senderRole="expert"
            />
          </div>
        </div>
      )}

      <ExpertSessionActions
        consultationId={id}
        locale={locale}
        active={live}
        initialPaymentStatus={consultation.paymentStatus}
      />
    </>
  );
}
