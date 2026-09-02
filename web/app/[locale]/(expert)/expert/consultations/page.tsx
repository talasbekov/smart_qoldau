import { authorizedFetch } from '@/lib/api/authorized';
import { listTopics } from '@/lib/api/public';
import ExpertConsultationList from '@/components/expert-cabinet/ExpertConsultationList';
import type { components } from '@/lib/api/generated';

type ExpertConsultation = components['schemas']['ConsultationExpertDto'];

export default async function ExpertConsultationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [items, topics] = await Promise.all([
    authorizedFetch<ExpertConsultation[]>('consultations'),
    listTopics(),
  ]);

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">Консультации</h1>
      <ExpertConsultationList items={items ?? []} topics={topics} locale={locale} />
    </>
  );
}
