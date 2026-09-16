import { notFound } from 'next/navigation';
import { authorizedFetch } from '@/lib/api/authorized';
import type { Consultation } from '@/components/client/ConsultationList';
import ConsultationAccess from '@/components/client/ConsultationAccess';
import { formatAlmatyDateTime } from '@/lib/format-almaty';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const consultation = await authorizedFetch<Consultation>(
    `consultations/${id}`,
  );
  if (!consultation) notFound();
  const copy = locale === 'kz' ? kz.consultations : ru.consultations;
  const statusLabels: Record<string, string> = {
    SCHEDULED: copy.statusScheduled,
    ACTIVE: copy.statusActive,
    COMPLETED: copy.statusCompleted,
    CANCELLED: copy.statusCancelled,
  };

  return (
    <>
      <h1 className="mb-1 text-2xl font-extrabold text-ink">
        {copy.detailTitle.replace('{expert}', consultation.expert.displayName)}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {statusLabels[consultation.status] ?? consultation.status}
      </p>
      <p className="mb-6 text-sm font-semibold text-body">
        {formatAlmatyDateTime(consultation.startedAt, locale, true)} ·{' '}
        {copy.timezoneAlmaty}
      </p>

      <ConsultationAccess consultation={consultation} locale={locale} />
    </>
  );
}
