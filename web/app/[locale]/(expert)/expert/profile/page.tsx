import { authorizedFetch } from '@/lib/api/authorized';
import { listTopics } from '@/lib/api/public';
import ExpertProfile from '@/components/expert-onboarding/ExpertProfile';
import type { ExpertDocument, ExpertMe } from '@/components/expert-onboarding/types';

export default async function ExpertProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [expert, documents, topics] = await Promise.all([
    authorizedFetch<ExpertMe>('experts/me'), authorizedFetch<ExpertDocument[]>('experts/me/documents'), listTopics(locale === 'kz' ? 'kz' : 'ru'),
  ]);
  if (!expert) return <p role="alert" className="rounded-2xl border border-border bg-white p-6 text-body">{locale === 'kz' ? 'Профильді жүктеу мүмкін болмады.' : 'Не удалось загрузить профиль.'}</p>;
  return <ExpertProfile locale={locale} topics={topics} initialExpert={expert} initialDocuments={documents} />;
}
