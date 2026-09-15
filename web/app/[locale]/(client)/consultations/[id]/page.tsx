import { notFound } from 'next/navigation';
import { authorizedFetch } from '@/lib/api/authorized';
import type { Consultation } from '@/components/client/ConsultationList';
import ConsultationAccess from '@/components/client/ConsultationAccess';

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Запланирована',
  ACTIVE: 'Идёт сейчас',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

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

  return (
    <>
      <h1 className="mb-1 text-2xl font-extrabold text-ink">
        Консультация с {consultation.expert.displayName}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {STATUS_LABELS[consultation.status] ?? consultation.status}
      </p>

      <ConsultationAccess consultation={consultation} locale={locale} />
    </>
  );
}
