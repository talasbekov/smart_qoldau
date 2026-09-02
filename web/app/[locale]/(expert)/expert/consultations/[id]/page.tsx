import { notFound } from 'next/navigation';
import { authorizedFetch } from '@/lib/api/authorized';
import Session from '@/components/client/Session';
import Chat from '@/components/client/Chat';
import type { components } from '@/lib/api/generated';

type ExpertConsultation = components['schemas']['ConsultationExpertDto'];

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Запланирована',
  ACTIVE: 'Идёт сейчас',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

export default async function ExpertConsultationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const consultation = await authorizedFetch<ExpertConsultation>(`consultations/${id}`);
  if (!consultation) notFound();

  const live = consultation.status === 'ACTIVE';
  const callFormat = consultation.format === 'chat' ? null : consultation.format;

  return (
    <>
      {/* Код клиента и здесь: имени эксперт не видит нигде. */}
      <h1 className="mb-1 text-2xl font-extrabold text-ink">
        Консультация · клиент №{consultation.clientCode}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {STATUS_LABELS[consultation.status] ?? consultation.status}
      </p>

      {live && callFormat ? (
        // Тот же компонент, что у клиента: разговор устроен одинаково с
        // обеих сторон, и копия кода разъехалась бы с оригиналом.
        <Session consultationId={id} format={callFormat as 'audio' | 'video'} />
      ) : (
        <div className="rounded-[20px] border border-border bg-white p-4">
          <Chat consultationId={id} />
        </div>
      )}
    </>
  );
}
