import { authorizedFetch } from '@/lib/api/authorized';
import { listTopics } from '@/lib/api/public';
import ExpertConsultationList from '@/components/expert-cabinet/ExpertConsultationList';
import type { components } from '@/lib/api/generated';
import ru from '@/messages/ru.json';
import kz from '@/messages/kz.json';

type ExpertConsultation = components['schemas']['ConsultationExpertDto'];

export default async function ExpertConsultationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = locale === 'kz' ? kz.expertCabinet : ru.expertCabinet;
  const [items, topics] = await Promise.all([
    authorizedFetch<ExpertConsultation[]>('consultations?as=expert'),
    listTopics(locale === 'kz' ? 'kz' : 'ru'),
  ]);

  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">
        {copy.consultationsTitle}
      </h1>
      {items ? (
        <ExpertConsultationList items={items} topics={topics} locale={locale} />
      ) : (
        <p
          role="alert"
          className="rounded-2xl border border-border bg-white p-6 text-body"
        >
          {copy.consultationsLoadError}
        </p>
      )}
    </>
  );
}
