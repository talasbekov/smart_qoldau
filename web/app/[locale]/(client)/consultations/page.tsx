import { authorizedFetch } from '@/lib/api/authorized';
import ConsultationList, { type Consultation } from '@/components/client/ConsultationList';

export default async function ConsultationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const items = (await authorizedFetch<Consultation[]>('consultations')) ?? [];

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">Консультации</h1>
      <ConsultationList items={items} locale={locale} />
    </>
  );
}
