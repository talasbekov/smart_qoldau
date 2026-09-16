import { notFound } from 'next/navigation';
import BookingFlow from '@/components/client/BookingFlow';
import type { Consultation } from '@/components/client/ConsultationList';
import { authorizedFetch } from '@/lib/api/authorized';

export default async function ReschedulePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const consultation = await authorizedFetch<Consultation>(
    `consultations/${id}`,
  );
  if (!consultation || consultation.status !== 'SCHEDULED') notFound();

  return (
    <BookingFlow
      expert={consultation.expert}
      topics={[]}
      locale={locale}
      consultation={consultation}
    />
  );
}
