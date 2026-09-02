import { notFound } from 'next/navigation';
import { authorizedFetch } from '@/lib/api/authorized';
import type { Consultation } from '@/components/client/ConsultationList';
import Session from '@/components/client/Session';
import Chat from '@/components/client/Chat';

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
  const { id } = await params;
  const consultation = await authorizedFetch<Consultation>(`consultations/${id}`);
  if (!consultation) notFound();

  const live = consultation.status === 'ACTIVE';
  const callFormat = consultation.format === 'chat' ? null : consultation.format;

  return (
    <>
      <h1 className="mb-1 text-2xl font-extrabold text-ink">
        Консультация с {consultation.expert.displayName}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {STATUS_LABELS[consultation.status] ?? consultation.status}
      </p>

      {live && callFormat ? (
        <Session consultationId={id} format={callFormat as 'audio' | 'video'} />
      ) : (
        // Чат остаётся доступен и до, и после звонка: переписка — часть
        // консультации, а не приложение к видео.
        <div className="rounded-[20px] border border-border bg-white p-4">
          <Chat consultationId={id} />
        </div>
      )}
    </>
  );
}
