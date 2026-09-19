import { journeyCopy } from '@/components/client/journey-copy';
import { redirect } from 'next/navigation';
import { listTopics } from '@/lib/api/public';
import { authorizedFetch } from '@/lib/api/authorized';
import RequestForm from '@/components/client/RequestForm';
import ExpertVisibilityConsent from '@/components/client/ExpertVisibilityConsent';

type Profile = {
  displayName: string | null;
  expertVisibilityAcceptedAt: string | null;
};

export default async function NewRequestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = journeyCopy(locale);
  const [topics, profile, current] = await Promise.all([
    listTopics(locale === 'kz' ? 'kz' : 'ru'),
    authorizedFetch<Profile>('me'),
    authorizedFetch<{ id: string; status: string; consultationId?: string }>(
      'requests/current',
    ),
  ]);

  if (current?.id)
    redirect(
      current.status === 'MATCHED' && current.consultationId
        ? `/${locale}/consultations/${current.consultationId}`
        : `/${locale}/requests/${current.id}`,
    );

  // Р-27: согласие спрашивается один раз, перед первой заявкой. Проверка
  // здесь — вежливость: сервер всё равно откажет без него, но человеку
  // лучше увидеть объяснение, а не ошибку после заполнения формы.
  if (!profile?.expertVisibilityAcceptedAt) {
    return <ExpertVisibilityConsent locale={locale} />;
  }

  return (
    <>
      <h1 className="mb-2 text-2xl font-extrabold text-ink">{copy.title}</h1>
      <p className="mb-8 text-sm text-muted">{copy.intro}</p>
      <RequestForm topics={topics} locale={locale} />
    </>
  );
}
