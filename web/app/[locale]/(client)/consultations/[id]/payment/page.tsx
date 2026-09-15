import { notFound } from 'next/navigation';
import { authorizedFetch } from '@/lib/api/authorized';
import type { Consultation } from '@/components/client/ConsultationList';
import PaymentCheckout from '@/components/client/PaymentCheckout';

export default async function ConsultationPaymentPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const consultation = await authorizedFetch<Consultation>(
    `consultations/${id}`,
  );
  if (!consultation) notFound();

  return <PaymentCheckout consultation={consultation} locale={locale} />;
}
